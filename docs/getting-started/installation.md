# Installation

## Prerequisites

- Node.js 20 or newer (required by the MCP SDK v2)
- npm 9 or newer
- git
- Optional: a GBIF.org account, only needed for occurrence download requests

The package is not published to npm; install it from source or run it in Docker.

## Option 1: From source with the install script (recommended)

```bash
git clone https://github.com/idss-mesa/gbif-mcp.git
cd gbif-mcp
npm install
npm run build
npm run install:agents
```

`npm run install:agents` runs `scripts/install.sh`, which registers the server with every
supported agent found on your machine: Claude Code, Claude Desktop, OpenAI Codex CLI,
Gemini CLI, Goose and OpenCode. Useful variants:

```bash
scripts/install.sh --agents all --dry-run        # preview the change for every agent
scripts/install.sh --agents claude,goose         # only some agents
scripts/install.sh --scope project               # project-level config where supported
scripts/install.sh --username you --password …   # store GBIF credentials for downloads
scripts/install.sh --uninstall                   # remove the registration everywhere
```

The script writes absolute paths for `node` and `build/index.js`, because desktop apps do not
inherit your shell `PATH`. Restart desktop apps after installing. On Windows run it from WSL or
Git Bash, or add the server by hand (see [Configuration](configuration.md)).

## Option 2: From source, manual registration

Build as above, then point your MCP client at `node /ABSOLUTE/PATH/TO/gbif-mcp/build/index.js`.

```bash
# Claude Code
claude mcp add gbif -- node "$(pwd)/build/index.js"
```

```json
// Claude Desktop, Gemini CLI and other JSON-configured clients
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/gbif-mcp/build/index.js"]
    }
  }
}
```

## Option 3: Docker

```bash
git clone https://github.com/idss-mesa/gbif-mcp.git
cd gbif-mcp
docker build -t gbif-mcp:latest .
docker run -i --rm gbif-mcp:latest
```

With credentials and a different log level:

```bash
docker run -i --rm \
  -e GBIF_USERNAME=your_username \
  -e GBIF_PASSWORD=your_password \
  -e LOG_LEVEL=debug \
  gbif-mcp:latest
```

Always keep `-i`; MCP talks over stdio, so the container must not run detached. In an MCP
client config use `"command": "docker"` with
`"args": ["run", "-i", "--rm", "gbif-mcp:latest"]`.

## Verify the installation

In Claude Code, `claude mcp list` runs a health check and shows `gbif` as connected. To talk to
the server directly:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{},"io.modelcontextprotocol/clientInfo":{"name":"manual","version":"0"}}}}' \
  | node build/index.js
```

The response lists the supported protocol version (`2026-07-28`) and the server's capabilities.
A `tools/list` request with the same `_meta` envelope returns all 58 tools.

## Configuration

All settings are environment variables; nothing is required. The most useful ones:

```bash
GBIF_USERNAME=            # only for occurrence downloads
GBIF_PASSWORD=
LOG_LEVEL=info            # error | warn | info | debug (logs go to stderr)
RESPONSE_MAX_SIZE_KB=250  # truncate tool results above this size
MCP_LEGACY_CLIENTS=serve  # serve | reject 2025-era `initialize` clients
```

See [Configuration](configuration.md) for the full list.

## Troubleshooting

**`node: command not found` from a desktop app.** Desktop apps do not read your shell profile.
Use the full path to `node` (`which node`) as the command; the install script does this for you.

**Server shows as disconnected.** Check that `build/index.js` exists, that the config uses
absolute paths, and that `node --version` reports 20 or newer.

**Port already in use.** MCP uses stdio, not network ports. A port error comes from something
else on your machine.

**401 on downloads.** Set `GBIF_USERNAME` and `GBIF_PASSWORD`; every other tool works anonymously.

## Upgrading

```bash
git pull origin main
npm install
npm run build
# Docker: docker build -t gbif-mcp:latest .
```

Registrations made by the install script keep pointing at `build/index.js`, so a rebuild is enough.

## Uninstallation

```bash
scripts/install.sh --uninstall   # remove the server from every agent config
cd .. && rm -rf gbif-mcp
docker rmi gbif-mcp:latest       # if you built the image
```

## Next Steps

- [Quick Start](quick-start.md) - your first query
- [Configuration](configuration.md) - all settings
- [All Tools](../user-guide/overview.md) - what the server can do
