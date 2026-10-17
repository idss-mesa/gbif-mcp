/**
 * Helpers for driving the real GBIF MCP server over stdio in integration tests.
 *
 * The server is started from source via `tsx` so no build step is required; the
 * stdio wiring (serveStdio + McpServer) is identical in the compiled output.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { VersionNegotiationOptions } from '@modelcontextprotocol/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(__dirname, '../../..');
export const TSX_BIN = resolve(PROJECT_ROOT, 'node_modules/.bin/tsx');
export const SERVER_ENTRY = resolve(PROJECT_ROOT, 'src/index.ts');

export const SERVER_ENV: Record<string, string> = {
  ...(process.env as Record<string, string>),
  LOG_LEVEL: 'error',
};

/** The reserved 2026-07-28 per-request `_meta` envelope a client must send. */
export const MODERN_META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'gbif-mcp-integration-test', version: '0.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
};

export type JsonRpcMessage = Record<string, any>;

/**
 * Raw JSON-RPC stdio session: write newline-delimited messages, collect replies.
 */
export class RawStdioSession {
  readonly proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private readonly messages: JsonRpcMessage[] = [];
  private readonly waiters: Array<() => void> = [];
  public stderr = '';
  public exitCode: number | null = null;

  constructor() {
    this.proc = spawn(TSX_BIN, [SERVER_ENTRY], { env: SERVER_ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          this.messages.push(JSON.parse(line));
        } catch {
          this.messages.push({ __raw: line });
        }
        this.waiters.splice(0).forEach(w => w());
      }
    });
    this.proc.stderr.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString('utf8');
    });
    this.proc.on('exit', code => {
      this.exitCode = code;
      this.waiters.splice(0).forEach(w => w());
    });
  }

  get alive(): boolean {
    return this.exitCode === null && !this.proc.killed;
  }

  sendRaw(line: string): void {
    this.proc.stdin.write(line + '\n');
  }

  send(message: JsonRpcMessage): void {
    this.sendRaw(JSON.stringify(message));
  }

  /** Send a request and wait for the response with the same id. */
  async request(message: JsonRpcMessage, timeoutMs = 15000): Promise<JsonRpcMessage> {
    this.send(message);
    return this.waitFor(m => m.id === message.id, timeoutMs);
  }

  async waitFor(predicate: (m: JsonRpcMessage) => boolean, timeoutMs = 15000): Promise<JsonRpcMessage> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (this.exitCode !== null) throw new Error(`Server exited with code ${this.exitCode}: ${this.stderr}`);
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for message. stderr: ${this.stderr}`);
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, Math.min(remaining, 250));
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  /** Wait a short while and confirm no message matching the predicate arrived. */
  async expectSilence(predicate: (m: JsonRpcMessage) => boolean, waitMs = 750): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return !this.messages.some(predicate);
  }

  /** Wait for the process to exit on its own; resolves to the exit code, or null on timeout. */
  async waitForExit(timeoutMs = 3000): Promise<number | null> {
    if (this.exitCode !== null) return this.exitCode;
    return new Promise<number | null>(resolve => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      this.proc.once('exit', code => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  }

  /** Close stdin (how MCP hosts signal shutdown); kill the process only if it does not exit by itself. */
  async close(): Promise<void> {
    if (this.exitCode !== null) return;
    this.proc.stdin.end();
    if ((await this.waitForExit(3000)) === null) {
      this.proc.kill('SIGKILL');
    }
  }
}

/**
 * Connect the official v2 MCP client to a freshly spawned server over stdio.
 */
export async function connectClient(
  versionNegotiation: VersionNegotiationOptions = { mode: 'auto' }
): Promise<Client> {
  const client = new Client(
    { name: 'gbif-mcp-integration-test', version: '0.0.0' },
    { versionNegotiation }
  );
  const transport = new StdioClientTransport({
    command: TSX_BIN,
    args: [SERVER_ENTRY],
    env: SERVER_ENV,
    stderr: 'pipe',
  });
  await client.connect(transport);
  return client;
}

/** Extract the text payload of a tool result and parse it as JSON when possible. */
export function parseToolText(result: any): { text: string; json: any } {
  const block = result?.content?.find((c: any) => c.type === 'text');
  const text: string = block?.text ?? '';
  let json: any = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { text, json };
}
