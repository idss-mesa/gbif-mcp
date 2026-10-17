/**
 * MCP 2026-07-28 protocol conformance over the real stdio transport.
 *
 * Exercises the wire behaviour of the running server (not just the tool classes):
 * - the stateless 2026-07-28 era: `server/discover`, per-request `_meta` envelope,
 *   `resultType` / `ttlMs` / `cacheScope` on cacheable results, removed methods;
 * - the 2025-era `initialize` handshake still being served for older clients;
 * - the official v2 client negotiating both eras;
 * - adversarial framing: malformed JSON, missing envelope, bogus versions, unknown tools.
 *
 * No GBIF network access is needed: every tool call here is rejected before any HTTP request.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { RawStdioSession, MODERN_META, connectClient, parseToolText } from '../helpers/stdio-server.js';

const EXPECTED_TOOL_COUNT = 58;
const sessions: RawStdioSession[] = [];
const open = () => {
  const s = new RawStdioSession();
  sessions.push(s);
  return s;
};

afterEach(async () => {
  await Promise.all(sessions.splice(0).map(s => s.close()));
});

describe('2026-07-28 era (stateless envelope)', () => {
  it('answers server/discover with supported versions, capabilities and server identity', async () => {
    const s = open();
    const res = await s.request({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: MODERN_META } });
    expect(res.error).toBeUndefined();
    expect(res.result.supportedVersions).toContain('2026-07-28');
    expect(res.result.capabilities.tools).toBeDefined();
    expect(res.result.resultType).toBe('complete');
    expect(res.result._meta['io.modelcontextprotocol/serverInfo'].name).toBe('gbif-mcp-server');
    expect(typeof res.result.instructions).toBe('string');
  });

  it('serves tools/list as a cacheable, complete result', async () => {
    const s = open();
    const res = await s.request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: MODERN_META } });
    expect(res.error).toBeUndefined();
    expect(res.result.resultType).toBe('complete');
    expect(res.result.cacheScope).toBe('public');
    expect(res.result.ttlMs).toBeGreaterThan(0);
    expect(res.result.tools).toHaveLength(EXPECTED_TOOL_COUNT);

    // Deterministic ordering (spec: SHOULD be stable for client-side caching)
    const again = await s.request({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: { _meta: MODERN_META } });
    expect(again.result.tools.map((t: any) => t.name)).toEqual(res.result.tools.map((t: any) => t.name));

    for (const tool of res.result.tools) {
      expect(tool.name).toMatch(/^gbif_[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.$schema).toBeUndefined();
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations.readOnlyHint).toBe('boolean');
    }
    const nonReadOnly = res.result.tools.filter((t: any) => t.annotations.readOnlyHint === false).map((t: any) => t.name).sort();
    expect(nonReadOnly).toEqual([
      'gbif_occurrence_download_request',
      'gbif_validator_validate_dwca',
      'gbif_validator_validate_tabular',
    ]);
  });

  it('rejects an envelope-less request on a modern connection with -32602', async () => {
    const s = open();
    // `server/discover` is a probe and does not pin the era; the first enveloped request does.
    await s.request({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: MODERN_META } });
    const res = await s.request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(res.error.code).toBe(-32602);
    expect(res.error.message).toMatch(/_meta envelope/);
  });

  it('rejects an unsupported protocol version claim with -32022 on the opening request', async () => {
    const s = open();
    const res = await s.request({
      jsonrpc: '2.0', id: 1, method: 'tools/list',
      params: { _meta: { ...MODERN_META, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } },
    });
    expect(res.error.code).toBe(-32022);
    expect(res.error.data.supported).toContain('2026-07-28');
    // The connection stays open for a correct opening afterwards
    const ok = await s.request({ jsonrpc: '2.0', id: 2, method: 'server/discover', params: { _meta: MODERN_META } });
    expect(ok.result.supportedVersions).toContain('2026-07-28');
  });

  it('rejects a legacy initialize once the connection is pinned to the modern era', async () => {
    const s = open();
    await s.request({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: MODERN_META } });
    const res = await s.request({
      jsonrpc: '2.0', id: 2, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'old', version: '0' } },
    });
    expect(res.error.code).toBe(-32022);
  });

  it('no longer exposes methods removed in 2026-07-28 (ping, logging/setLevel)', async () => {
    const s = open();
    const ping = await s.request({ jsonrpc: '2.0', id: 1, method: 'ping', params: { _meta: MODERN_META } });
    expect(ping.error.code).toBe(-32601);
    const log = await s.request({ jsonrpc: '2.0', id: 2, method: 'logging/setLevel', params: { _meta: MODERN_META, level: 'debug' } });
    expect(log.error.code).toBe(-32601);
  });

  it('returns a structured tool error (not a protocol error) for invalid tool arguments', async () => {
    const s = open();
    const res = await s.request({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { _meta: MODERN_META, name: 'gbif_species_get', arguments: { key: 'not-a-number' } },
    });
    expect(res.error).toBeUndefined();
    expect(res.result.isError).toBe(true);
    expect(res.result.resultType).toBe('complete');
    expect(res.result.content[0].type).toBe('text');
    expect(res.result.content[0].text).toMatch(/key/);
  });

  it('answers an unknown tool name with an InvalidParams error', async () => {
    const s = open();
    const res = await s.request({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { _meta: MODERN_META, name: 'gbif_does_not_exist', arguments: {} },
    });
    expect(res.error.code).toBe(-32602);
    expect(res.error.message).toMatch(/not found/);
  });

  it('treats server/discover as a non-pinning probe: a legacy client may still initialize afterwards', async () => {
    const s = open();
    const discover = await s.request({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: MODERN_META } });
    expect(discover.result.supportedVersions).toContain('2026-07-28');
    const init = await s.request({
      jsonrpc: '2.0', id: 2, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fallback', version: '0' } },
    });
    expect(init.error).toBeUndefined();
    expect(init.result.protocolVersion).toBe('2025-06-18');
  });

  it('survives malformed input and keeps serving', async () => {
    const s = open();
    s.sendRaw('this is not json');
    s.sendRaw('{"jsonrpc":"2.0","id":"x"');
    s.sendRaw('[]');
    s.sendRaw(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 42, params: null }));
    const res = await s.request({ jsonrpc: '2.0', id: 8, method: 'server/discover', params: { _meta: MODERN_META } });
    expect(res.result.supportedVersions).toContain('2026-07-28');
    expect(s.alive).toBe(true);
  });
});

describe('process lifecycle', () => {
  it('exits on its own when the client closes stdin (default settings, metrics enabled)', async () => {
    const s = open();
    await s.request({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: MODERN_META } });
    s.proc.stdin.end();
    const t0 = Date.now();
    const code = await s.waitForExit(5000);
    expect(code, `server still running ${Date.now() - t0}ms after stdin EOF`).toBe(0);
  });

  it('exits on its own after a legacy session ends', async () => {
    const s = open();
    await s.request({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'legacy', version: '0' } },
    });
    s.proc.stdin.end();
    expect(await s.waitForExit(5000)).toBe(0);
  });
});

describe('2025-era clients (legacy initialize handshake)', () => {
  it('still completes the initialize handshake and lists tools', async () => {
    const s = open();
    const init = await s.request({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'legacy', version: '0' } },
    });
    expect(init.error).toBeUndefined();
    expect(init.result.protocolVersion).toBe('2025-06-18');
    expect(init.result.serverInfo.name).toBe('gbif-mcp-server');
    expect(init.result.capabilities.tools).toBeDefined();
    s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    const list = await s.request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(list.result.tools).toHaveLength(EXPECTED_TOOL_COUNT);
    expect(list.result.resultType).toBeUndefined();

    const ping = await s.request({ jsonrpc: '2.0', id: 3, method: 'ping' });
    expect(ping.result).toEqual({});
  });

  it('negotiates down to the latest 2025 revision for a 2024-11-05 client', async () => {
    const s = open();
    const init = await s.request({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'older', version: '0' } },
    });
    expect(init.error).toBeUndefined();
    expect(init.result.protocolVersion).toBe('2024-11-05');
  });

  it('does not answer server/discover on a legacy-pinned connection', async () => {
    const s = open();
    await s.request({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'legacy', version: '0' } },
    });
    s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const res = await s.request({ jsonrpc: '2.0', id: 2, method: 'server/discover', params: {} });
    expect(res.error.code).toBe(-32601);
  });
});

describe('official @modelcontextprotocol/client', () => {
  it('negotiates the modern era with versionNegotiation auto', async () => {
    const client = await connectClient({ mode: 'auto' });
    try {
      expect(client.getProtocolEra()).toBe('modern');
      expect(client.getServerVersion()?.name).toBe('gbif-mcp-server');
      const discover = await client.discover();
      expect(discover.supportedVersions).toContain('2026-07-28');
      const list = await client.listTools();
      expect(list.tools).toHaveLength(EXPECTED_TOOL_COUNT);
      expect((list as any).cacheScope).toBe('public');
      const bad = await client.callTool({ name: 'gbif_species_get', arguments: { key: 'abc' } });
      expect(bad.isError).toBe(true);
      expect(parseToolText(bad).text).toMatch(/key/);
    } finally {
      await client.close();
    }
  });

  it('connects a pinned 2026-07-28 client', async () => {
    const client = await connectClient({ mode: { pin: '2026-07-28' } });
    try {
      expect(client.getProtocolEra()).toBe('modern');
      expect((await client.listTools()).tools).toHaveLength(EXPECTED_TOOL_COUNT);
    } finally {
      await client.close();
    }
  });

  it('connects a legacy (2025-era) client', async () => {
    const client = await connectClient({ mode: 'legacy' });
    try {
      expect(client.getProtocolEra()).toBe('legacy');
      expect((await client.listTools()).tools).toHaveLength(EXPECTED_TOOL_COUNT);
      const bad = await client.callTool({ name: 'gbif_species_get', arguments: {} });
      expect(bad.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});
