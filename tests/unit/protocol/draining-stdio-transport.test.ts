import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import type { JSONRPCMessage } from '@modelcontextprotocol/server';
import { DrainingStdioTransport } from '../../../src/protocol/draining-stdio-transport.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 20));

function setup(drainTimeoutMs = 5000) {
  const source = new PassThrough();
  const stdout = new PassThrough();
  const transport = new DrainingStdioTransport(source, stdout, drainTimeoutMs);
  const received: JSONRPCMessage[] = [];
  let closed = false;
  transport.onmessage = message => received.push(message);
  transport.onclose = () => {
    closed = true;
  };
  let drained = false;
  void transport.drained.then(() => {
    drained = true;
  });
  const write = (message: object) => source.write(JSON.stringify(message) + '\n');
  return { source, stdout, transport, received, write, isClosed: () => closed, isDrained: () => drained };
}

describe('DrainingStdioTransport', () => {
  it('keeps the connection open after input EOF until in-flight requests are answered', async () => {
    const t = setup();
    await t.transport.start();

    t.write({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'x' } });
    t.source.end();
    await tick();

    expect(t.received).toHaveLength(1);
    expect(t.transport.pendingRequests).toBe(1);
    expect(t.isDrained()).toBe(false);
    expect(t.isClosed()).toBe(false);

    const out: string[] = [];
    t.stdout.on('data', chunk => out.push(chunk.toString()));
    await t.transport.send({ jsonrpc: '2.0', id: 7, result: { content: [] } });
    await t.transport.drained;
    await tick();

    expect(out.join('')).toContain('"id":7');
    expect(t.transport.pendingRequests).toBe(0);
    expect(t.isClosed()).toBe(true);
  });

  it('closes promptly when nothing is in flight', async () => {
    const t = setup();
    await t.transport.start();

    t.write({ jsonrpc: '2.0', method: 'notifications/initialized' });
    t.source.end();
    await t.transport.drained;
    await tick();

    expect(t.received).toHaveLength(1);
    expect(t.isClosed()).toBe(true);
  });

  it('counts requests still buffered when the input ends', async () => {
    const t = setup();
    await t.transport.start();

    t.write({ jsonrpc: '2.0', id: 'a', method: 'tools/call', params: {} });
    t.source.end();
    await tick();

    expect(t.transport.pendingRequests).toBe(1);
    expect(t.isDrained()).toBe(false);
    await t.transport.send({ jsonrpc: '2.0', id: 'a', error: { code: -32603, message: 'failed' } });
    await t.transport.drained;
  });

  it('gives up after the drain timeout', async () => {
    const t = setup(50);
    await t.transport.start();

    t.write({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} });
    t.source.end();
    const started = Date.now();
    await t.transport.drained;
    await tick();

    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
    expect(t.transport.pendingRequests).toBe(1);
    expect(t.isClosed()).toBe(true);
  });
});
