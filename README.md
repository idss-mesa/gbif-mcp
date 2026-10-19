# GBIF MCP Server

[![MCP 2026-07-28](https://img.shields.io/badge/MCP-2026--07--28-blue)](https://modelcontextprotocol.io/)
[![Node 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![59 tools](https://img.shields.io/badge/tools-59-informational)](#available-tools)
[![License: CC BY 4.0](https://img.shields.io/badge/license-CC--BY--4.0-lightgrey)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI assistants
programmatic access to the [Global Biodiversity Information Facility (GBIF)](https://www.gbif.org/)
API: species taxonomy, 2+ billion occurrence records, datasets and publishers, map tiles,
literature citing GBIF data, controlled vocabularies and data validation.

Works with Claude Code, Claude Desktop, OpenAI Codex CLI, Gemini CLI, Goose, OpenCode and any
other MCP client that can launch a stdio server.

## Quick start

```bash
git clone https://github.com/idss-mesa/gbif-mcp.git
cd gbif-mcp
npm install
npm run build

# Register the server with every supported agent found on this machine
npm run install:agents
```

Then ask your assistant something like *"Search GBIF for Panthera leo occurrences in Kenya"*.

Requires **Node.js 20 or newer**. GBIF credentials are optional and only needed for
occurrence download requests (see [Configuration](#configuration)).

## Contents

- [Protocol support](#protocol-support)
- [Installation](#installation)
  - [Install script](#install-script)
  - [Claude Code](#claude-code)
  - [Claude Desktop](#claude-desktop)
  - [Codex CLI, Gemini CLI, Goose, OpenCode](#codex-cli-gemini-cli-goose-opencode)
  - [Docker](#docker)
- [Configuration](#configuration)
- [Available tools](#available-tools)
- [Usage examples](#usage-examples)
- [Response size limits](#response-size-limits)
- [Verifying the server](#verifying-the-server)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Protocol support

The server implements **MCP protocol revision 2026-07-28** through the v2 TypeScript SDK
(`@modelcontextprotocol/server`). Each connection is served in whichever era the client speaks:

| Client | Handshake | Served |
|---|---|---|
| 2026-07-28 | per-request `_meta` envelope, optional `server/discover` probe | yes |
| 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05 | classic `initialize` | yes (default) |

Current Claude Desktop and Claude Code builds still use the `initialize` handshake and work
without any configuration change. Set `MCP_LEGACY_CLIENTS=reject` to accept 2026-07-28 clients
only; older clients then receive error `-32022` (unsupported protocol version).

Other 2026-07-28 details:

- `tools/list` is advertised as cacheable (`ttlMs` 1 hour, `cacheScope: public`).
- Every tool carries `annotations` (`readOnlyHint`, `idempotentHint`, `openWorldHint`). Only the
  download and validator tools, which create jobs on GBIF, are marked non-read-only.
- Tool arguments are validated against the advertised JSON Schema before execution. Invalid
  arguments and unknown tools return JSON-RPC error `-32602`.
- Failed GBIF calls come back as tool results with `isError: true` and a JSON error envelope,
  never as a crashed connection.
- `ping`, `logging/setLevel`, sampling, roots and elicitation are not used. Logs go to stderr.
- The process exits when the client closes stdin, so no orphaned servers are left behind.

## Installation

### Install script

`scripts/install.sh` registers the server with every supported agent it finds. It builds the
server if `build/index.js` is missing, prefers each agent's own CLI when one is installed
(`claude mcp add`, `codex mcp add`, `gemini mcp add`) and otherwise merges an entry into the
agent's config file, keeping everything else in the file and leaving a `.bak` copy.

```bash
npm run install:agents                           # every agent detected on this machine
scripts/install.sh --agents all --dry-run        # preview the change for every agent
scripts/install.sh --agents claude,goose         # just Claude Code and Goose
scripts/install.sh --scope project               # project-level config (claude, codex, gemini, opencode)
scripts/install.sh --username you --password …   # store GBIF credentials for download requests
scripts/install.sh --env LOG_LEVEL=debug         # any extra environment variable
scripts/install.sh --uninstall                   # remove the registration everywhere
```

| Agent | What the script does |
|---|---|
| `claude` (Claude Code) | `claude mcp add --scope user gbif -- node build/index.js` |
| `claude-desktop` | adds `mcpServers.gbif` to `claude_desktop_config.json` (macOS / Linux paths) |
| `codex` (OpenAI Codex CLI) | `codex mcp add gbif -- node build/index.js`, or a `[mcp_servers.gbif]` table in `~/.codex/config.toml` |
| `gemini` (Gemini CLI) | `gemini mcp add --scope user gbif node build/index.js`, or `mcpServers.gbif` in `~/.gemini/settings.json` |
| `goose` | adds a `gbif` stdio extension to `~/.config/goose/config.yaml` |
| `opencode` | adds `mcp.servers.gbif` (v2) or `mcp.gbif` (v1) to `~/.config/opencode/opencode.json` |

The script writes absolute paths for `node` and `build/index.js`, because desktop apps do not
inherit your shell `PATH`. It needs bash and Node.js 20+. On Windows run it from WSL or Git Bash,
or follow the manual steps below. Restart desktop apps (Claude Desktop, Goose Desktop) after
installing.

### Claude Code

```bash
cd /path/to/gbif-mcp
claude mcp add gbif -- node "$(pwd)/build/index.js"

# with GBIF credentials for download requests
claude mcp add gbif -e GBIF_USERNAME=you -e GBIF_PASSWORD=secret -- node "$(pwd)/build/index.js"

claude mcp list        # shows gbif with a health check
claude mcp get gbif    # details and connection status
claude mcp remove gbif
```

Use `--scope project` to write the entry to `.mcp.json` in the current repository instead of
your user config.

### Claude Desktop

Add the server to the configuration file and restart Claude Desktop:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"],
      "env": {
        "GBIF_USERNAME": "optional-username",
        "GBIF_PASSWORD": "optional-password"
      }
    }
  }
}
```

Use absolute paths (not `~/` or `./`). On Windows escape backslashes:
`"C:\\Users\\You\\gbif-mcp\\build\\index.js"`. If `node` is not found, replace `"command": "node"`
with the full path printed by `which node` (or `where node` on Windows).

### Codex CLI, Gemini CLI, Goose, OpenCode

The install script handles all four. The equivalent manual entries are:

```toml
# ~/.codex/config.toml
[mcp_servers.gbif]
command = "node"
args = ["/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"]
```

```json
// ~/.gemini/settings.json
{ "mcpServers": { "gbif": { "command": "node", "args": ["/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"] } } }
```

```yaml
# ~/.config/goose/config.yaml
extensions:
  gbif:
    enabled: true
    type: stdio
    name: gbif
    cmd: node
    args: ["/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"]
    envs: {}
    timeout: 300
```

```json
// ~/.config/opencode/opencode.json (OpenCode v2; v1 uses "mcp": { "gbif": … })
{ "mcp": { "servers": { "gbif": { "type": "local", "command": ["node", "/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"], "enabled": true } } } }
```

Any other MCP client that can launch a stdio command works the same way:
`node /ABSOLUTE/PATH/TO/gbif-mcp/build/index.js`.

### Docker

```bash
docker build -t gbif-mcp:latest .
docker run -i --rm gbif-mcp:latest            # stdio: keep -i, never -d
```

Claude Desktop / any JSON-configured client:

```json
{
  "mcpServers": {
    "gbif": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GBIF_USERNAME=you", "-e", "GBIF_PASSWORD=secret", "gbif-mcp:latest"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add gbif -- docker run -i --rm gbif-mcp:latest
```

With Docker Compose, build with `docker compose build` and point the client at
`docker compose run --rm gbif-mcp`. The image is a multi-stage Node 20 Alpine build
(about 150 MB) that runs as a non-root user on a read-only root filesystem.

## Configuration

All settings are environment variables. Defaults are shown; nothing is required.

```bash
# GBIF credentials (only for occurrence download requests)
GBIF_USERNAME=
GBIF_PASSWORD=

# GBIF API
GBIF_BASE_URL=https://api.gbif.org/v1
GBIF_USER_AGENT=GBIF-MCP-Server/1.1.0
GBIF_TIMEOUT=30000

# Rate limiting and caching
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_CONCURRENT=10
CACHE_ENABLED=true
CACHE_MAX_SIZE=100
CACHE_TTL=3600000

# Response size limits (see below)
RESPONSE_MAX_SIZE_KB=250
RESPONSE_WARN_SIZE_KB=200
RESPONSE_ENABLE_TRUNCATION=true
RESPONSE_ENABLE_SIZE_LOGGING=true

# Logging (stderr; stdout is reserved for the protocol)
LOG_LEVEL=info          # error | warn | info | debug
LOG_FORMAT=json

# MCP protocol: serve (also accept 2025-era `initialize` clients) or reject
MCP_LEGACY_CLIENTS=serve
```

A `.env` file in the project root is read during local development.

## Available tools

59 tools across seven GBIF API sections. Every parameter carries a description, valid values
and a real example value (for instance `taxonKey: 212` for family Felidae), so assistants can
build correct queries without guessing. Results are paginated with `offset`/`limit` and an
`endOfRecords` flag.

### Species (14)

| Tool | Purpose |
|---|---|
| `gbif_species_search` | Full-text search of the taxonomic backbone with rank, status, habitat, threat and dataset filters |
| `gbif_species_get` | Full record for a taxon key |
| `gbif_species_match` | Fuzzy-match a scientific name to the backbone |
| `gbif_species_suggest` | Autocomplete name suggestions |
| `gbif_species_parse_names` | Parse scientific names into their components |
| `gbif_species_children` | Direct taxonomic children |
| `gbif_species_parents` | Full classification path |
| `gbif_species_related` | Sibling and related taxa under the same parent |
| `gbif_species_synonyms` | Synonyms of a taxon |
| `gbif_species_vernacular_names` | Common names by language |
| `gbif_species_descriptions` | Textual descriptions |
| `gbif_species_distributions` | Geographic distributions |
| `gbif_species_media` | Images, sounds and videos |
| `gbif_species_metrics` | Occurrence statistics for a species: record, dataset and country counts, basis-of-record breakdown |

### Occurrence (15)

| Tool | Purpose |
|---|---|
| `gbif_occurrence_search` | Search records with 40+ filters (taxon, country, coordinates, dates, basis of record, media, issues…) |
| `gbif_occurrence_get` | A single interpreted record |
| `gbif_occurrence_verbatim` | The original, uninterpreted record |
| `gbif_occurrence_count` | Count records matching a filter |
| `gbif_occurrence_counts_by_basis_of_record` | Breakdown by basis of record |
| `gbif_occurrence_counts_by_year` | Breakdown by year |
| `gbif_occurrence_counts_by_country` | Breakdown by country |
| `gbif_occurrence_counts_by_publishing_country` | Breakdown by publishing country |
| `gbif_occurrence_counts_by_dataset` | Breakdown by dataset |
| `gbif_occurrence_counts_by_taxon` | Breakdown by species within a higher taxon |
| `gbif_occurrence_counts_by_publishing_org` | Breakdown by publishing organization |
| `gbif_occurrence_download_predicate_builder` | Build a download predicate from search filters |
| `gbif_occurrence_download_request` | Request a download (needs credentials; `creator` defaults to `GBIF_USERNAME`) |
| `gbif_occurrence_download_status` | Check a download's status |
| `gbif_occurrence_download_list` | List your past downloads with keys, DOIs and links (needs credentials) |

The "counts by" tools use GBIF faceted search, so every filter of `gbif_occurrence_search`
applies to them.

### Registry (18)

| Tool | Purpose |
|---|---|
| `gbif_registry_search_datasets`, `gbif_registry_get_dataset` | Datasets |
| `gbif_registry_dataset_metrics`, `gbif_registry_dataset_document` | Occurrence/quality metrics and the EML metadata document |
| `gbif_registry_search_organizations`, `gbif_registry_get_organization`, `gbif_registry_organization_datasets` | Publishing organizations |
| `gbif_registry_search_networks`, `gbif_registry_get_network`, `gbif_registry_network_datasets` | Networks |
| `gbif_registry_search_installations`, `gbif_registry_get_installation` | Technical installations (IPTs etc.) |
| `gbif_registry_list_nodes`, `gbif_registry_get_node` | GBIF participant nodes |
| `gbif_registry_search_collections`, `gbif_registry_get_collection` | GRSciColl collections |
| `gbif_registry_search_institutions`, `gbif_registry_get_institution` | GRSciColl institutions |

### Maps (4)

`gbif_maps_get_tile_url`, `gbif_maps_get_raster_tile_url`, `gbif_maps_get_vector_tile_url`,
`gbif_maps_list_styles`. These build GBIF map tile URLs (density maps of occurrences for any
search filter) rather than returning image bytes.

### Literature (2)

`gbif_literature_search` (papers citing GBIF-mediated data, with topic, year, dataset,
peer-review and open-access filters) and `gbif_literature_get` (one paper by DOI).

### Vocabularies (3)

`gbif_vocabularies_list`, `gbif_vocabularies_get`, `gbif_vocabularies_get_concept` for GBIF's
controlled vocabularies (LifeStage, Sex, BasisOfRecord, …).

### Validator (3)

`gbif_validator_validate_dwca`, `gbif_validator_validate_tabular` (submit a Darwin Core archive
or a CSV/TSV file for validation) and `gbif_validator_get_status`.

The full reference with every parameter is in [TOOLS.md](TOOLS.md) and under
[docs/api-reference](docs/api-reference).

## Usage examples

Once a client is connected, ask in plain language:

- "Search for occurrence records of *Panthera tigris* in India since 2020."
- "What is the GBIF backbone key for *Quercus robur*, and what are its common names in German?"
- "How many bird observations were recorded in California in 2023, broken down by month?"
- "Find preserved orchid specimens collected before 1900 that have images."
- "Which datasets does the Natural History Museum publish, and which is the largest?"
- "Show me recent papers that used GBIF data on pollinators."
- "Give me a map tile URL for all *Apis mellifera* records in Europe."

## Response size limits

To fit AI context windows the server limits every tool result to 250 KB by default
(`RESPONSE_MAX_SIZE_KB`). For paginated GBIF responses it keeps as many results as fit and
adds pagination guidance; for other responses it returns metadata only. A truncated result
looks like:

```json
{
  "truncated": true,
  "originalSize": "1.2MB",
  "returnedSize": "248KB",
  "metadata": { "totalCount": 1000, "returnedCount": 23 },
  "pagination": {
    "suggestion": "Use limit=20 with offset=0, then offset=20, offset=40...",
    "example": { "taxonKey": 212, "limit": 20, "offset": 0 }
  },
  "data": { "...": "..." }
}
```

Set `RESPONSE_ENABLE_TRUNCATION=false` to disable it.

## Verifying the server

From Claude Code, `claude mcp list` runs a health check and should show `gbif` as connected.
To exercise the stdio surface directly:

```bash
npm run build

# 2026-07-28 client: every request carries the protocol envelope in _meta
echo '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{},"io.modelcontextprotocol/clientInfo":{"name":"manual","version":"0"}}}}' \
  | node build/index.js

# 2025-era client: classic initialize handshake, then tools/list
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node build/index.js
```

Both commands print JSON-RPC responses on stdout and exit once stdin closes.

## Troubleshooting

**Server does not connect.** Check that `build/index.js` exists, that the config uses absolute
paths, and that `node --version` reports 20 or newer. Claude Desktop logs live in
`~/Library/Logs/Claude/` (macOS) or `%APPDATA%\Claude\logs\` (Windows). In Claude Code,
`claude mcp get gbif` shows the connection status and `claude mcp remove gbif` followed by
`claude mcp add` re-registers it.

**`node: command not found` from a desktop app.** Desktop apps do not read your shell profile.
Use the full path to `node` as the `command`, which is what the install script does.

**401 on download requests.** Downloads need a GBIF account. Set `GBIF_USERNAME` and
`GBIF_PASSWORD` in the server's `env`; everything else works anonymously.

**Rate limiting or slow responses.** Use the count and "counts by" tools before large searches,
keep `limit` small, and use an occurrence download for anything beyond a few thousand records.
The client retries 5xx and 429 answers with backoff and opens a circuit breaker after repeated
service failures; 404s for unknown keys do not count.

**Docker.** Always run with `-i` (and usually `--rm`); never `-d`, since MCP needs the stdio
connection. Pass credentials with `-e` or `--env-file`.

**Build errors.** `rm -rf build node_modules && npm install && npm run build`, then
`npm run typecheck` to see TypeScript diagnostics.

## Development

```bash
npm run dev                         # run from source with tsx, watch mode
npm run build                       # compile to build/
npm run typecheck                   # tsc --noEmit
npm run test:unit                   # unit tests (GBIF API mocked with MSW)
npm run test:integration:protocol   # stdio conformance: 2026-07-28 + legacy clients, official v2 client
npm run test:integration:api        # adversarial matrix: every tool against the live GBIF API
npm run test:coverage               # coverage report
npm run format                      # Prettier
```

Project layout:

```
src/
  index.ts            GBIFMCPServer: McpServer factory, serveStdio, tool dispatch, shutdown
  core/gbif-client.ts HTTP client: queue, rate limit, LRU cache, retries, circuit breaker
  services/           one service per GBIF API section
  tools/              59 tools, one class each, Zod input schemas → JSON Schema
  protocol/           error formatting, correlation IDs
  utils/              response truncation, logging
tests/
  unit/               mirrors src/
  integration/mcp/    protocol tests (stdio-protocol.test.ts spawns the real server)
  integration/api/    live GBIF tests, including all-tools.integration.test.ts
scripts/install.sh    agent registration script
```

Adding a GBIF endpoint: write the service method, add a `BaseTool` subclass under
`src/tools/<section>/`, export it from that folder's `index.ts`, register it in
`initializeServices()` in `src/index.ts`, and add a case to the adversarial matrix.
See [CLAUDE.md](CLAUDE.md) for conventions.

## Resources

- [GBIF API documentation](https://techdocs.gbif.org/en/openapi/)
- [GBIF](https://www.gbif.org/) and the [GBIF community forum](https://discourse.gbif.org/)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2026-07-28)

## Contributing

Issues and pull requests are welcome. Fork the repository, create a branch, add tests for
service or tool changes (unit plus a line in the adversarial matrix), and open a pull request.

## License

[Creative Commons Attribution 4.0 International](LICENSE) (CC BY 4.0).

GBIF data accessed through this server is subject to the licence of each dataset; see
[GBIF's data use terms](https://www.gbif.org/terms).
