/**
 * Stdio transport that answers in-flight requests before closing.
 *
 * The SDK's StdioServerTransport closes as soon as stdin reaches EOF and aborts
 * any request still being handled, so a client that writes its requests and then
 * closes stdin never sees the answers to slow (network-bound) tool calls. This
 * transport reads from a proxy of the real input instead: when the input ends it
 * waits until every request it delivered has been answered (bounded by
 * `drainTimeoutMs`), then ends the proxy so the SDK closes as usual.
 */

import { PassThrough, type Readable, type Writable } from 'node:stream';
import type { JSONRPCMessage, RequestId } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

export const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;

// Structural checks: the SDK's isJSONRPC* guards schema-parse the whole (possibly large) message.
const requestId = (message: JSONRPCMessage): RequestId | undefined =>
  'method' in message && 'id' in message ? (message.id as RequestId) : undefined;
const responseId = (message: JSONRPCMessage): RequestId | undefined =>
  !('method' in message) && 'id' in message ? (message.id as RequestId) : undefined;

export class DrainingStdioTransport extends StdioServerTransport {
  private readonly pending = new Set<RequestId>();
  private idleWaiters: Array<() => void> = [];

  /** Resolves once the input has ended and in-flight requests are answered (or the drain timed out). */
  readonly drained: Promise<void>;

  constructor(
    source: Readable = process.stdin,
    stdout: Writable = process.stdout,
    drainTimeoutMs: number = DEFAULT_DRAIN_TIMEOUT_MS
  ) {
    const input = new PassThrough();
    super(input, stdout);

    source.pipe(input, { end: false });
    this.drained = new Promise<void>((resolve) => {
      let ended = false;
      const onEnd = () => {
        if (ended) return;
        ended = true;
        void this.waitForIdle(drainTimeoutMs).then(() => {
          input.end();
          resolve();
        });
      };
      source.once('end', onEnd);
      source.once('close', onEnd);
    });
  }

  /** Number of delivered requests that have not been answered yet. */
  get pendingRequests(): number {
    return this.pending.size;
  }

  override async start(): Promise<void> {
    // serveStdio installs onmessage before starting the transport; wrap it to count requests.
    const deliver = this.onmessage;
    this.onmessage = (message: JSONRPCMessage) => {
      const id = requestId(message);
      if (id !== undefined) this.pending.add(id);
      deliver?.(message);
    };
    return super.start();
  }

  override async send(message: JSONRPCMessage): Promise<void> {
    try {
      await super.send(message);
    } finally {
      const id = responseId(message);
      if (id !== undefined && this.pending.delete(id)) {
        if (this.pending.size === 0) this.idleWaiters.splice(0).forEach((wake) => wake());
      }
    }
  }

  private async waitForIdle(timeoutMs: number): Promise<void> {
    // Let requests still buffered in the proxy reach the SDK before checking.
    await new Promise((resolve) => setImmediate(resolve));
    if (this.pending.size === 0) return;

    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      new Promise<void>((resolve) => this.idleWaiters.push(resolve)),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
    clearTimeout(timer);
  }
}
