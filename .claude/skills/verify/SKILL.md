---
name: verify
description: How to run and drive the GBIF MCP server over stdio to verify a change at its real surface (both the 2026-07-28 era and legacy 2025 clients).
---

# Verifying gbif-mcp at its surface (stdio)

Build first: `npm run build` (output `build/index.js`). Node >= 20.

## Drive it with raw JSON-RPC (what an MCP host does)

Every 2026-07-28 request needs the `_meta` envelope; `server/discover` is a probe and does
not pin the era, the first enveloped request after it does.

```bash
META='{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{},"io.modelcontextprotocol/clientInfo":{"name":"manual","version":"0"}}'
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":'"$META"'}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"_meta":'"$META"',"name":"gbif_species_match","arguments":{"name":"Puma concolor"}}}' \
  | LOG_LEVEL=error node build/index.js
```

Legacy client: send `initialize` (protocolVersion 2025-06-18), `notifications/initialized`,
then `tools/list` / `tools/call` without `_meta`. `MCP_LEGACY_CLIENTS=reject` answers the
initialize with error -32022.

Official client (already a devDependency): run from the repo root so modules resolve:
`node --input-type=module -e "$(cat script.mjs)"` with
`new Client({...}, { versionNegotiation: { mode: 'auto' } })` and
`StdioClientTransport({ command: process.execPath, args: ['build/index.js'] })`.
`client.getProtocolEra()` should be `'modern'`.

## Flows worth driving

- discover → tools/list (59 tools, `ttlMs` 3600000, `cacheScope` public) → a live tool call.
- Repaired tools: `gbif_occurrence_counts_by_*` (must honour `taxonKey`/`country`),
  `gbif_species_parse_names`, `gbif_registry_search_{organizations,networks,installations}`,
  `gbif_registry_dataset_document` (XML), `gbif_literature_get` (DOI or doi.org URL).
- Several 404 lookups (`gbif_species_get` with key 999999990) followed by a valid call:
  the circuit breaker must stay closed.
- Errors: tool errors come back as results with `isError: true` and a JSON envelope;
  unknown tool / missing envelope are JSON-RPC errors (-32602).

## Gotchas

- When the client closes stdin, the server first answers the requests it already received
  (`DrainingStdioTransport`, capped at 10 s), then exits with code 0 (~100 ms when nothing is
  in flight). So a `printf … | node build/index.js` driver gets every response. If a response
  is missing, or a run leaves processes behind, treat it as a regression of the stdin-EOF
  drain/shutdown (see `process lifecycle` tests in `stdio-protocol.test.ts`); clean up with
  `pkill -f gbif-mcp/build/index.js` — but note Claude Code's own gbif MCP connection runs
  the same command, so check the parent process first.
- macOS has no `timeout` command; do not wrap drivers in it.
- Logs go to stderr as JSON; `LOG_LEVEL=error` keeps them quiet.
- Live GBIF calls take 0.2-1 s each; the server's rate limit is 100 requests/min by default.
