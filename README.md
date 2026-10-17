# GBIF MCP Server

A Model Context Protocol (MCP) server providing programmatic access to the Global Biodiversity Information Facility (GBIF) API.

## Overview

This MCP server enables AI assistants and applications to interact with GBIF's extensive biodiversity data through the Model Context Protocol. GBIF provides access to hundreds of millions of species occurrence records, taxonomic information, and biodiversity research data from around the world.

## What is GBIF?

The [Global Biodiversity Information Facility (GBIF)](https://www.gbif.org/) is an international network and data infrastructure that provides open access to biodiversity data. The GBIF API offers programmatic access to:

- **Species Data**: Taxonomic information, species discovery, and name-matching utilities
- **Occurrence Records**: Indexed records of species observations and specimens
- **Datasets**: Information about published datasets and their sources
- **Organizations**: Data about publishing organizations and institutions
- **Maps**: Visualization of biodiversity data
- **Literature**: Peer-reviewed papers citing GBIF datasets
- **Vocabularies**: Standardized terminology for biodiversity data

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) is an open protocol that standardizes how AI applications interact with external data sources and tools. This server implements MCP to make GBIF's biodiversity data accessible to AI assistants like Claude.

## Protocol Support

This server speaks **MCP protocol revision 2026-07-28** (the stateless revision: per-request `_meta` envelope, `server/discover`, cacheable `tools/list`, multi-round-trip results) using the v2 TypeScript SDK. Clients that still use the 2025-era `initialize` handshake (for example current Claude Desktop and Claude Code builds) are detected per connection and served unchanged, so no client configuration changes are needed. Set `MCP_LEGACY_CLIENTS=reject` to accept 2026-07-28 clients only.

Requires **Node.js 20 or newer**.

## Quick Start

```bash
# 1. Clone and build
git clone https://github.com/tyson-swetnam/gbif-mcp.git
cd gbif-mcp
npm install
npm run build

# 2. Add to Claude Code
claude mcp add gbif node "$(pwd)/build/index.js"

# 3. Test it
claude chat "Search GBIF for Panthera leo occurrences in Kenya"
```

Or for Claude Desktop, add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"]
    }
  }
}
```

## Features

This MCP server provides access to key GBIF API endpoints with comprehensive parameter documentation:

- **Species API**: Search for species, get taxonomic information, and match scientific names
- **Occurrence API**: Query species occurrence records with 40+ advanced filters
- **Registry API**: Access information about datasets and publishing organizations
- **Maps API**: Generate visualizations of biodiversity data
- **Literature API**: Search for research papers citing GBIF data
- **Validator API**: Perform data quality checks

### Comprehensive Parameter Descriptions

Every tool parameter includes:
- **Detailed explanations** of purpose and usage
- **Real-world examples** with actual GBIF data (e.g., "Example: 212 for family Felidae")
- **Valid value lists** for enums with human-readable descriptions
- **Range constraints** and data type information
- **Links to GBIF API documentation** for additional reference

This makes it easy for AI assistants to construct accurate queries without guessing parameter formats.

## Response Size Limits

To ensure compatibility with AI context windows, this server implements automatic response size limiting:

- **Maximum Response Size**: 250KB (configurable via `RESPONSE_MAX_SIZE_KB`)
- **Warning Threshold**: 200KB (logs warnings for optimization)
- **Smart Truncation**: Large responses are automatically truncated with helpful pagination guidance

### Configuration

Control response limiting via environment variables:

```bash
RESPONSE_MAX_SIZE_KB=250              # Maximum response size
RESPONSE_WARN_SIZE_KB=200             # Warning threshold
RESPONSE_ENABLE_TRUNCATION=true       # Enable smart truncation
RESPONSE_ENABLE_SIZE_LOGGING=true     # Log size metrics
```

### Truncated Responses

When a response exceeds the size limit, you'll receive:

```json
{
  "truncated": true,
  "originalSize": "1.2MB",
  "returnedSize": "248KB",
  "metadata": {
    "totalCount": 1000,
    "returnedCount": 23
  },
  "pagination": {
    "suggestion": "Use limit=20 with offset=0, then offset=20, offset=40...",
    "example": { "taxonKey": 212, "limit": 20, "offset": 0 }
  },
  "data": { ... }
}
```

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/tyson-swetnam/gbif-mcp.git
cd gbif-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

### From NPM (when published)

```bash
npm install -g gbif-mcp
```

### Using Docker

```bash
# Clone the repository
git clone https://github.com/tyson-swetnam/gbif-mcp.git
cd gbif-mcp

# Build the Docker image
docker build -t gbif-mcp:latest .

# Or use Docker Compose
docker-compose build
```

The Docker image uses a multi-stage build with Alpine Linux for a small footprint (~150MB).

## Configuration

### Quickest: the install script

`scripts/install.sh` registers the server with every supported agent it finds on your machine
(Claude Code, Claude Desktop, OpenAI Codex CLI, Gemini CLI, Goose, OpenCode). It builds the
server if needed, uses each agent's own CLI when one exists (`claude mcp add`, `codex mcp add`,
`gemini mcp add`) and otherwise edits the agent's config file in place, keeping everything else
in the file and leaving a `.bak` copy.

```bash
npm run install:agents                         # every agent detected on this machine
scripts/install.sh --agents all --dry-run      # preview the change for every agent
scripts/install.sh --agents claude,goose       # just Claude Code and Goose
scripts/install.sh --scope project             # project-level config (claude, codex, gemini, opencode)
scripts/install.sh --username you --password … # store GBIF credentials for download requests
scripts/install.sh --uninstall                 # remove the registration everywhere
```

| Agent | What the script does |
|---|---|
| `claude` (Claude Code) | `claude mcp add --scope user gbif -- node build/index.js` |
| `claude-desktop` | adds `mcpServers.gbif` to `claude_desktop_config.json` (macOS / Linux paths) |
| `codex` (OpenAI Codex CLI) | `codex mcp add gbif -- node build/index.js`, or a `[mcp_servers.gbif]` table in `~/.codex/config.toml` |
| `gemini` (Gemini CLI) | `gemini mcp add --scope user gbif node build/index.js`, or `mcpServers.gbif` in `~/.gemini/settings.json` |
| `goose` | adds a `gbif` stdio extension to `~/.config/goose/config.yaml` |
| `opencode` | adds `mcp.servers.gbif` (v2) or `mcp.gbif` (v1) to `~/.config/opencode/opencode.json` |

The script needs bash and Node.js 20+. On Windows run it from WSL or Git Bash, or follow the
manual steps below (Claude Desktop on Windows: `%APPDATA%\Claude\claude_desktop_config.json`).
Restart desktop apps (Claude Desktop, Goose Desktop) after installing.

### Option 1: Claude Desktop App

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"],
      "env": {
        "GBIF_USERNAME": "your-username",
        "GBIF_PASSWORD": "your-password"
      }
    }
  }
}
```

**Important**: Replace `/ABSOLUTE/PATH/TO` with the full path to your cloned repository.

**Example** (macOS):
```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/Users/yourname/projects/gbif-mcp/build/index.js"]
    }
  }
}
```

**Example** (Windows):
```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\projects\\gbif-mcp\\build\\index.js"]
    }
  }
}
```

After updating the configuration:
1. Save the file
2. Restart Claude Desktop
3. Look for the 🔌 icon to verify the MCP server is connected

### Option 2: Claude Code CLI

If you're using [Claude Code](https://docs.claude.com/claude-code), you can add the MCP server using the CLI:

```bash
# Navigate to your gbif-mcp directory
cd /path/to/gbif-mcp

# Add the MCP server
claude mcp add gbif node build/index.js

# Or with environment variables for authenticated endpoints
claude mcp add gbif node build/index.js --env GBIF_USERNAME=your-username --env GBIF_PASSWORD=your-password
```

Verify the installation:
```bash
# List all MCP servers
claude mcp list

# Test the connection
claude mcp test gbif
```

### Option 3: Docker Container

Run the MCP server in a Docker container for isolated, reproducible deployments:

#### Quick Start with Docker

```bash
# Build the image
docker build -t gbif-mcp:latest .

# Run the container (stdio mode for MCP)
docker run -i gbif-mcp:latest
```

#### Claude Desktop with Docker

Update your Claude Desktop configuration to use the Docker container:

**macOS/Linux**:
```json
{
  "mcpServers": {
    "gbif": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "GBIF_USERNAME=your-username",
        "-e", "GBIF_PASSWORD=your-password",
        "gbif-mcp:latest"
      ]
    }
  }
}
```

**Windows**:
```json
{
  "mcpServers": {
    "gbif": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "GBIF_USERNAME=your-username",
        "-e", "GBIF_PASSWORD=your-password",
        "gbif-mcp:latest"
      ]
    }
  }
}
```

#### Claude Code CLI with Docker

```bash
# Add the Docker-based MCP server
claude mcp add gbif docker run -i --rm gbif-mcp:latest

# With environment variables
claude mcp add gbif docker run -i --rm \
  -e GBIF_USERNAME=your-username \
  -e GBIF_PASSWORD=your-password \
  gbif-mcp:latest
```

#### Docker Compose

For easier management, use Docker Compose:

```bash
# Start the service
docker-compose up -d gbif-mcp

# View logs
docker-compose logs -f gbif-mcp

# Stop the service
docker-compose down
```

Edit `docker-compose.yml` to configure environment variables:

```yaml
environment:
  - GBIF_USERNAME=${GBIF_USERNAME}
  - GBIF_PASSWORD=${GBIF_PASSWORD}
  - LOG_LEVEL=debug  # Change log level
```

Then use in Claude Desktop config:

```json
{
  "mcpServers": {
    "gbif": {
      "command": "docker",
      "args": ["compose", "run", "--rm", "gbif-mcp"]
    }
  }
}
```

#### Docker Environment Variables

Pass environment variables to the Docker container:

```bash
# Using -e flags
docker run -i --rm \
  -e GBIF_USERNAME=myusername \
  -e GBIF_PASSWORD=mypassword \
  -e LOG_LEVEL=debug \
  -e CACHE_ENABLED=true \
  gbif-mcp:latest

# Using an env file
echo "GBIF_USERNAME=myusername" > .env.docker
echo "GBIF_PASSWORD=mypassword" >> .env.docker
docker run -i --rm --env-file .env.docker gbif-mcp:latest
```

#### Docker Image Details

- **Base Image**: Node.js 20 Alpine Linux
- **Size**: ~150MB (multi-stage build)
- **User**: Runs as non-root user (uid 1001)
- **Security**: Read-only root filesystem, no new privileges
- **Health Check**: Built-in health monitoring

### Option 4: Other MCP Clients

For other MCP-compatible clients (Codex, Gemini CLI, etc.), add the server to the client's configuration file following their MCP server setup documentation:

**General MCP Configuration Format**:
```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/absolute/path/to/gbif-mcp/build/index.js"],
      "env": {
        "GBIF_USERNAME": "optional-username",
        "GBIF_PASSWORD": "optional-password"
      }
    }
  }
}
```

### Environment Variables

Create a `.env` file in the project root for local development (optional):

```bash
# GBIF API Credentials (optional - only needed for downloads and authenticated endpoints)
GBIF_USERNAME=your-gbif-username
GBIF_PASSWORD=your-gbif-password

# GBIF API Configuration (optional - defaults shown)
GBIF_BASE_URL=https://api.gbif.org/v1
GBIF_USER_AGENT=GBIF-MCP-Server/1.1.0
GBIF_TIMEOUT=30000

# Rate Limiting (optional - defaults shown)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_CONCURRENT=10

# Caching (optional - defaults shown)
CACHE_ENABLED=true
CACHE_MAX_SIZE=100
CACHE_TTL=3600000

# Logging (optional - defaults shown)
LOG_LEVEL=info
LOG_FORMAT=json

# MCP protocol (optional - default shown)
# serve  = also accept 2025-era clients that open with `initialize`
# reject = only accept 2026-07-28 clients
MCP_LEGACY_CLIENTS=serve
```

**Note**: Most GBIF API endpoints do not require authentication. Credentials are only needed for:
- Requesting occurrence downloads
- Accessing private datasets
- Publishing data (not currently implemented)

## Verifying Installation

After configuration, verify the server is working:

### In Claude Desktop:
1. Open Claude Desktop
2. Look for the 🔌 MCP icon in the interface
3. Try a query: "Search GBIF for Panthera leo occurrences in Kenya"

### In Claude Code CLI:
```bash
# List available tools
claude mcp tools gbif

# Test a simple query
claude chat "Use the gbif MCP server to search for Panthera leo"
```

### Manual Test (stdio):
```bash
# Build and test the server directly
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

## Available Tools

The server provides the following MCP tools for interacting with GBIF data:

### Species Tools
- `gbif_species_search` - Search for species with advanced filtering
- `gbif_species_get` - Get detailed information about a specific species
- `gbif_species_suggest` - Get species name suggestions for autocomplete
- `gbif_species_match` - Fuzzy match a species name against GBIF taxonomy
- `gbif_species_children` - Get direct taxonomic children of a taxon
- `gbif_species_parents` - Get complete taxonomic classification path
- `gbif_species_synonyms` - Get synonyms and alternative names
- `gbif_species_vernacular_names` - Get common names in multiple languages
- `gbif_species_descriptions` - Get textual descriptions of species
- `gbif_species_distributions` - Get geographic distribution information
- `gbif_species_media` - Get images, sounds, and videos

### Occurrence Tools
- `gbif_occurrence_search` - Search occurrence records with 40+ filter parameters
- `gbif_occurrence_get` - Get complete details for a single occurrence
- `gbif_occurrence_count` - Fast counting without retrieving full records
- `gbif_occurrence_verbatim` - Get original unprocessed occurrence data
- `gbif_occurrence_download_request` - Request large dataset downloads (requires auth)
- `gbif_occurrence_download_status` - Check download status
- `gbif_occurrence_download_predicate_builder` - Build download filters

All tools include comprehensive parameter descriptions with examples. Use `claude mcp tools gbif` to see the full list.

## Usage Examples

Once configured, you can use the MCP server through your AI assistant:

### Species Queries
- "Search for occurrence records of Panthera tigris in India"
- "Find taxonomic information for the species Quercus robur"
- "What are the common names for Apis mellifera in different languages?"
- "Show me the complete taxonomic classification for the African lion"
- "Find all synonyms for the scientific name Felis leo"

### Occurrence Queries
- "How many bird observations were recorded in California in 2023?"
- "Find preserved specimens of orchids collected before 1900"
- "Show me occurrence records with photos from National Parks"
- "Search for endangered species observations in Brazil"

### Data Management
- "List datasets published by the Natural History Museum"
- "Show me recent papers citing GBIF data about pollinators"
- "Validate this biodiversity dataset before publication"

## Troubleshooting

### Server Not Connecting

**Claude Desktop:**
1. Check the configuration file path is correct
2. Verify you're using absolute paths (not relative paths like `~/` or `./`)
3. Ensure the build directory exists: `ls /path/to/gbif-mcp/build/index.js`
4. Check Claude Desktop logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

**Claude Code CLI:**
```bash
# Check server status
claude mcp status gbif

# View logs
claude mcp logs gbif

# Remove and re-add
claude mcp remove gbif
claude mcp add gbif node /absolute/path/to/gbif-mcp/build/index.js
```

### Build Errors

```bash
# Clean and rebuild
rm -rf build node_modules
npm install
npm run build

# Check for TypeScript errors
npm run build -- --noEmit
```

### Docker Issues

**Image Build Fails:**
```bash
# Clean Docker cache and rebuild
docker system prune -a
docker build --no-cache -t gbif-mcp:latest .

# Check Docker version (requires 20.10+)
docker --version
```

**Container Won't Start:**
```bash
# Check container logs
docker logs <container-id>

# Run with debug logging
docker run -i --rm -e LOG_LEVEL=debug gbif-mcp:latest

# Test container health
docker run --rm gbif-mcp:latest node -e "console.log('test')"
```

**Permission Issues:**
```bash
# Ensure Docker daemon is running
docker ps

# Check if user has Docker permissions (Linux)
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

**Environment Variables Not Working:**
```bash
# Verify environment variables are passed
docker run -i --rm gbif-mcp:latest node -e "console.log(process.env.GBIF_USERNAME)"

# Use --env-file for multiple variables
docker run -i --rm --env-file .env.docker gbif-mcp:latest
```

**MCP Communication Issues with Docker:**
- Ensure you're using `-i` (interactive) flag for stdio communication
- Use `--rm` to automatically remove containers after execution
- Don't use `-d` (detached) mode - MCP needs stdio connection
- Check that the command in your MCP config exactly matches: `docker run -i --rm gbif-mcp:latest`

### Authentication Issues

If you're getting 401 errors for downloads:
1. Verify your GBIF credentials at [GBIF.org](https://www.gbif.org/user/profile)
2. Check environment variables are set correctly
3. Create a `.env` file in the project root with your credentials
4. Note: Most endpoints don't require authentication - only downloads do

### Rate Limiting

If you're being rate limited:
1. Reduce query frequency
2. Use the count endpoint before large searches
3. Consider caching results
4. Use occurrence downloads for large datasets instead of pagination

### Node.js Version

Ensure you're using Node.js 20 or higher (required by the MCP SDK v2):
```bash
node --version  # Should be v20.0.0 or higher
```

## API Coverage

This MCP server implements the following GBIF API sections:

- ✅ Species API
- ✅ Occurrence API
- ✅ Registry API
- ✅ Maps API
- ✅ Literature API
- ✅ Vocabularies API
- ✅ Validator API

## Development

```bash
# Run in development mode
npm run dev

# Run unit tests (mocked GBIF API)
npm run test:unit

# Protocol conformance over stdio (2026-07-28 and legacy clients, official v2 client)
npm run test:integration:protocol

# Adversarial verification of every tool against the live GBIF API (needs network)
npm run test:integration:api

# Lint code
npm run lint
```

## Resources

- [GBIF API Documentation](https://techdocs.gbif.org/en/openapi/)
- [GBIF Website](https://www.gbif.org/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [GBIF API Base URL](https://api.gbif.org/)

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT License](LICENSE)

## Acknowledgments

This project uses the GBIF API to provide access to biodiversity data. GBIF is funded by governments and maintains a stable, version 1 API with backward compatibility guarantees.

## Support

- GBIF API Issues: [GBIF GitHub](https://github.com/gbif)
- GBIF Community Forum: [discourse.gbif.org](https://discourse.gbif.org/)
- MCP Issues: Open an issue in this repository
