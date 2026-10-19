# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides programmatic access to the GBIF (Global Biodiversity Information Facility) API. The server enables AI assistants to interact with GBIF's biodiversity data including species information, occurrence records, datasets, organizations, maps, literature, and vocabularies.

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript to build/ directory
npm run dev          # Run in development mode with watch (uses tsx)
npm start            # Run built server from build/index.js
npm test             # Run all tests with Vitest (watch mode)
npm run test:unit    # Run unit tests only
npm run test:integration      # Run integration tests
npm run test:integration:mcp  # Run MCP protocol integration tests (incl. stdio conformance)
npm run test:integration:protocol  # Run only the 2026-07-28 stdio protocol conformance test
npm run test:integration:api  # Run real GBIF API integration tests (--run, no watch; needs network)
npm run test:all     # Run unit + integration tests sequentially
npm run test:coverage # Run tests with coverage report
npm run lint         # Lint TypeScript files in src/
npm run format       # Format code with Prettier
npm run clean        # Remove build directory
npm run typecheck    # Type-check without emitting files
npm run install:agents  # Register the server with Claude Code/Desktop, Codex, Gemini, Goose, OpenCode (scripts/install.sh)
npm run docs:tools      # Regenerate TOOLS.md from the built server's tools/list (scripts/gen-tools-md.mjs)
```

Run a single test file: `npm test -- tests/unit/species.service.test.ts`

## Architecture Overview

### Request Flow

```
stdio (serveStdio, era negotiation) → McpServer (SDK v2) → GBIFMCPServer.handleToolCall → BaseTool.execute → Service Layer → GBIF Client → GBIF API
```

### MCP Protocol Revision

The server implements **MCP 2026-07-28** through the v2 TypeScript SDK (`@modelcontextprotocol/server`, Node 20+). Key points:

- `src/index.ts` builds an `McpServer` in a factory (`createMcpServer()`) and hands it to `serveStdio()` from `@modelcontextprotocol/server/stdio`. The stdio entry picks the protocol era per connection: 2026-07-28 clients send a per-request `_meta` envelope (and may probe with `server/discover`); 2025-era clients still open with `initialize` and are served unchanged (`MCP_LEGACY_CLIENTS=reject` turns them away).
- Tools are registered with `registerTool()` using `fromJsonSchema()` + the AJV validator over the JSON Schema that `BaseTool.getDefinition()` produces from Zod (the project keeps Zod 3 + `zod-to-json-schema`; the SDK's own Zod 4 is internal). The SDK validates arguments against the advertised schema before `BaseTool.execute()` re-validates with Zod and applies defaults.
- `tools/list` is advertised as cacheable (`ttlMs` 1h, `cacheScope: public`); every tool carries `annotations` (read-only except the download/validator job-creating tools).
- `ping`, `logging/setLevel`, sampling, roots and elicitation requests are not used (removed or deprecated in 2026-07-28). Logging goes to stderr.
- `tests/integration/mcp/stdio-protocol.test.ts` is the wire-level conformance test (raw JSON-RPC for both eras plus the official v2 client); `tests/integration/helpers/stdio-server.ts` spawns the server from source with `tsx`.

### Key Components

1. **Entry Point** (`src/index.ts`): `GBIFMCPServer` class handles server initialization, tool registration via `initializeServices()`, MCP protocol request handlers, graceful shutdown, and statistics tracking.

2. **GBIF Client** (`src/core/gbif-client.ts`): Centralized HTTP client with circuit breaker pattern (CLOSED → OPEN after 5 failures → HALF_OPEN after 1 min → CLOSED after 2 successes), LRU cache, request queue with concurrency control (p-queue), rate limiting, and exponential backoff retries for 5xx/429. Only service-side failures (5xx, 429, 408, network/timeouts) count towards the breaker; 4xx answers such as 404 for an unknown key are treated as a healthy signal (`GBIFClient.isServiceFailure`). `get()` accepts optional `headers`/`responseType` for non-JSON endpoints (dataset EML documents).

3. **Tool Registry** (`src/core/tool-registry.ts`): Manages MCP tool registration and lookup by name.

4. **Service Layer** (`src/services/`): Seven domain services wrapping GBIF API endpoints:
   - `species/species.service.ts` - Taxonomic operations
   - `occurrence/occurrence.service.ts` - Occurrence data queries. All "counts by X" tools use faceted search (`/occurrence/search?limit=0&facet=X`) via `getFacetCounts()`; GBIF's `/occurrence/counts/*` endpoints are retired or ignore filters.
   - `registry/registry.service.ts` - Datasets, organizations, networks, installations, collections, institutions, nodes
   - `maps/maps.service.ts` - Map tile URLs
   - `literature/literature.service.ts` - Research papers citing GBIF data
   - `vocabularies/vocabularies.service.ts` - Standardized terminology
   - `validator/validator.service.ts` - Data quality validation

5. **Tool Layer** (`src/tools/`): 59 MCP tools organized by domain, all inheriting from `BaseTool` abstract class. Each tool uses Zod schemas for input validation and converts them to JSON Schema via `zod-to-json-schema` (no `$schema` marker, `additionalProperties` only for `.strict()` objects). Override the `annotations` field for tools that are not read-only.

6. **Response Truncation** (`src/utils/response-truncator.ts`): Integrated into `BaseTool.execute()` — automatically truncates responses exceeding 250KB (configurable). For paginated GBIF responses (those with `results` arrays), it fits as many results as possible under the limit and includes pagination guidance. Non-paginated responses get a metadata-only response.

7. **Protocol Layer** (`src/protocol/`): `RequestHandler` provides correlation ID tracking via `withContext()`. `MCPErrors` defines standardized error codes and formatting.

### Tool Implementation Pattern

All tools follow this pattern and are registered in `src/index.ts` `initializeServices()`:

```typescript
class ExampleTool extends BaseTool<InputType, OutputType> {
  protected name = 'tool_name';
  protected description = 'What this tool does';
  protected inputSchema = z.object({ /* zod schema */ });

  protected async run(input: InputType): Promise<OutputType> {
    // Tool logic using injected service
  }
}
```

### Adding a New GBIF API Section

1. Create service in `src/services/[name]/[name].service.ts`
2. Create tools in `src/tools/[name]/` inheriting from `BaseTool`
3. Export tools from `src/tools/[name]/index.ts`
4. Register tools in `src/index.ts` `initializeServices()` method
5. Add types to `src/types/gbif.types.ts` if needed

## TypeScript Configuration

- **Module System**: NodeNext (ESM). **Always use `.js` extensions in imports** (e.g., `from './config.js'`). TypeScript resolves to `.ts` during compilation but emits `.js` paths.
- **Target**: ES2022, strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- **Output**: `build/` directory with source maps and declarations

## Testing

- **Framework**: Vitest with v8 coverage provider
- **Mocking**: MSW (Mock Service Worker) via `tests/setup.ts` — intercepts HTTP requests, points GBIF base URL to `http://localhost:3000`, disables caching and sets log level to `error`
- **Test Structure**: `tests/unit/` mirrors `src/` structure; `tests/integration/mcp/` for protocol tests (`stdio-protocol.test.ts` spawns the real server); `tests/integration/api/` for real GBIF API tests. `all-tools.integration.test.ts` is the adversarial matrix: a valid call plus hostile/invalid calls for every tool over stdio against the live API; run it after touching any service endpoint.
- **Integration setup**: `tests/integration/setup.ts` is separate from unit test setup

## Configuration

Configuration in `src/config/config.ts` uses Zod schema validation over environment variables. Key settings:

- `GBIF_BASE_URL` - API base URL (default: `https://api.gbif.org/v1`)
- `GBIF_USERNAME` / `GBIF_PASSWORD` - Optional credentials (only needed for downloads)
- `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_CONCURRENT` - Rate limiting
- `CACHE_ENABLED` / `CACHE_MAX_SIZE` / `CACHE_TTL` - Caching
- `RESPONSE_MAX_SIZE_KB` / `RESPONSE_WARN_SIZE_KB` / `RESPONSE_ENABLE_TRUNCATION` / `RESPONSE_ENABLE_SIZE_LOGGING` - Response size limits
- `LOG_LEVEL` - Logging verbosity (error/warn/info/debug)
- `MCP_LEGACY_CLIENTS` - `serve` (default) or `reject` 2025-era clients that open with `initialize`

## Logging

Winston logs to **stderr** (stdout is reserved for MCP protocol). JSON structured format with correlation IDs tracked through `RequestHandler.withContext()`.

## MCP Protocol Details

- **Protocol revision**: 2026-07-28 (stateless `_meta` envelope, `server/discover`), with 2025-era `initialize` clients still served
- **Transport**: stdio (`serveStdio` from `@modelcontextprotocol/server/stdio`)
- **Capabilities**: `tools` only (`tools/list` cacheable, 1h public)
- **Response Format**: JSON with `content` array containing `text` type; failures are tool results with `isError: true` and a JSON error envelope
- GBIF uses `offset`/`limit` pagination with `endOfRecords` flag

## Git Workflow

After completing each task, commit changes with a descriptive message. Stage related files together (e.g., a service + its tests + types) and commit as one logical unit.

## Docker Support

Multi-stage build using Node 20 Alpine (~150MB image). Node 20+ is required by the v2 MCP SDK. Non-root user, read-only filesystem, built-in health check.

```bash
docker build -t gbif-mcp . && docker run -i gbif-mcp
```

## License

Creative Commons Attribution 4.0 International License.
