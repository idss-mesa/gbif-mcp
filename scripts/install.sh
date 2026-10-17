#!/usr/bin/env bash
#
# Register the GBIF MCP server with AI coding agents.
#
# Supported agents:
#   claude          Claude Code CLI            (claude mcp add, user scope)
#   claude-desktop  Claude Desktop app         (claude_desktop_config.json)
#   codex           OpenAI Codex CLI           (codex mcp add, or ~/.codex/config.toml)
#   gemini          Gemini CLI                 (gemini mcp add, or ~/.gemini/settings.json)
#   goose           Block Goose CLI / Desktop  (~/.config/goose/config.yaml)
#   opencode        OpenCode                   (~/.config/opencode/opencode.json, v1 or v2 schema)
#
# Usage:
#   scripts/install.sh [options]
#
#   --agents LIST     Comma-separated agents from the list above, or "all".
#                     Default: every agent whose CLI or config file is found on this machine.
#   --scope SCOPE     user (default) or project. "project" writes the agent's project-level
#                     config in the current directory (claude, codex, gemini, opencode).
#   --name NAME       Server name to register (default: gbif).
#   --username USER   GBIF username, stored in the server's env (only needed for downloads).
#   --password PASS   GBIF password, stored in the server's env.
#   --env KEY=VALUE   Extra environment variable for the server (repeatable).
#   --prefer-files    Edit config files directly even when an agent CLI is available.
#   --uninstall       Remove the server registration instead of adding it.
#   --dry-run         Show what would change without writing anything.
#   --no-build        Do not run npm install / npm run build when build/index.js is missing.
#   -h, --help        Show this help.
#
# Examples:
#   scripts/install.sh                          # register with every detected agent
#   scripts/install.sh --agents claude,goose    # just Claude Code and Goose
#   scripts/install.sh --agents all --dry-run   # preview every agent's config change
#   scripts/install.sh --uninstall              # remove the registration everywhere
#
set -euo pipefail

SERVER_NAME="gbif"
AGENTS=""
SCOPE="user"
DRY_RUN=0
UNINSTALL=0
PREFER_FILES=0
NO_BUILD=0
GBIF_USERNAME_OPT=""
GBIF_PASSWORD_OPT=""
EXTRA_ENV=()

usage() { sed -n '2,36p' "$0" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents) AGENTS="$2"; shift 2 ;;
    --agents=*) AGENTS="${1#*=}"; shift ;;
    --scope) SCOPE="$2"; shift 2 ;;
    --scope=*) SCOPE="${1#*=}"; shift ;;
    --name) SERVER_NAME="$2"; shift 2 ;;
    --username) GBIF_USERNAME_OPT="$2"; shift 2 ;;
    --password) GBIF_PASSWORD_OPT="$2"; shift 2 ;;
    --env) EXTRA_ENV+=("$2"); shift 2 ;;
    --prefer-files) PREFER_FILES=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-build) NO_BUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$SCOPE" in user|project) ;; *) echo "--scope must be user or project" >&2; exit 2 ;; esac

# ---------------------------------------------------------------- locate server and node
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_JS="$REPO_DIR/build/index.js"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is not on PATH. Install Node.js 20 or newer first." >&2
  exit 1
fi
NODE_BIN="$(command -v node)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "error: Node.js 20 or newer is required (found $(node --version))." >&2
  exit 1
fi

if [[ $UNINSTALL -eq 0 && ! -f "$SERVER_JS" ]]; then
  if [[ $NO_BUILD -eq 1 || $DRY_RUN -eq 1 ]]; then
    echo "note: $SERVER_JS does not exist yet; run 'npm install && npm run build' in $REPO_DIR." >&2
  else
    echo "Building the server (build/index.js not found)..."
    (cd "$REPO_DIR" && npm install --no-fund --no-audit && npm run build)
  fi
fi

# Environment passed to the server
SERVER_ENV=()
[[ -n "$GBIF_USERNAME_OPT" ]] && SERVER_ENV+=("GBIF_USERNAME=$GBIF_USERNAME_OPT")
[[ -n "$GBIF_PASSWORD_OPT" ]] && SERVER_ENV+=("GBIF_PASSWORD=$GBIF_PASSWORD_OPT")
if [[ ${#EXTRA_ENV[@]} -gt 0 ]]; then SERVER_ENV+=("${EXTRA_ENV[@]}"); fi
ENV_JSON="$(printf '%s\n' "${SERVER_ENV[@]:-}" | node -e '
  const out = {};
  for (const line of require("fs").readFileSync(0, "utf8").split("\n")) {
    if (!line) continue; const i = line.indexOf("="); if (i < 1) continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  process.stdout.write(JSON.stringify(out));')"

# ---------------------------------------------------------------- platform paths
OS="$(uname -s)"
case "$OS" in
  Darwin) CLAUDE_DESKTOP_CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
  *)      CLAUDE_DESKTOP_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/Claude/claude_desktop_config.json" ;;
esac
CODEX_USER_CFG="${CODEX_HOME:-$HOME/.codex}/config.toml"
CODEX_PROJECT_CFG="$PWD/.codex/config.toml"
GEMINI_USER_CFG="$HOME/.gemini/settings.json"
GEMINI_PROJECT_CFG="$PWD/.gemini/settings.json"
GOOSE_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/goose/config.yaml"
OPENCODE_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"

have() { command -v "$1" >/dev/null 2>&1; }
log()  { printf '%s\n' "$*"; }
say()  { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

run() {
  # Print and (unless dry-run) execute a command.
  say "\$ $*"
  if [[ $DRY_RUN -eq 0 ]]; then "$@"; fi
}

# ---------------------------------------------------------------- config editing helper (node)
# edit_config <format> <file> : merges/removes the server entry, preserving everything else.
# format: claude-json | gemini-json | opencode-v1 | opencode-v2 | toml | goose-yaml
edit_config() {
  local format="$1" file="$2"
  CFG_FORMAT="$format" CFG_FILE="$file" CFG_NAME="$SERVER_NAME" CFG_NODE="$NODE_BIN" \
  CFG_SERVER="$SERVER_JS" CFG_ENV="$ENV_JSON" CFG_UNINSTALL="$UNINSTALL" CFG_DRY="$DRY_RUN" \
  node - <<'JS'
const fs = require('fs');
const path = require('path');
const { CFG_FORMAT: format, CFG_FILE: file, CFG_NAME: name, CFG_NODE: nodeBin, CFG_SERVER: serverJs } = process.env;
const env = JSON.parse(process.env.CFG_ENV || '{}');
const uninstall = process.env.CFG_UNINSTALL === '1';
const dry = process.env.CFG_DRY === '1';
const hasEnv = Object.keys(env).length > 0;

const exists = fs.existsSync(file);
const original = exists ? fs.readFileSync(file, 'utf8') : '';
let next;

function parseJson(text) {
  if (!text.trim()) return {};
  try { return JSON.parse(text); } catch (e) {
    console.error(`  ! ${file} is not plain JSON (${e.message}). Edit it by hand; see the snippet below.`);
    return null;
  }
}
function stringify(obj) { return JSON.stringify(obj, null, 2) + '\n'; }

if (format === 'claude-json' || format === 'gemini-json') {
  const cfg = parseJson(original); if (cfg === null) process.exit(3);
  cfg.mcpServers = cfg.mcpServers || {};
  if (uninstall) delete cfg.mcpServers[name];
  else cfg.mcpServers[name] = { command: nodeBin, args: [serverJs], ...(hasEnv ? { env } : {}) };
  next = stringify(cfg);
} else if (format === 'opencode-v1' || format === 'opencode-v2') {
  const cfg = parseJson(original); if (cfg === null) process.exit(3);
  if (!cfg.$schema) cfg.$schema = 'https://opencode.ai/config.json';
  cfg.mcp = cfg.mcp || {};
  const entry = { type: 'local', command: [nodeBin, serverJs], ...(hasEnv ? { environment: env } : {}) };
  if (format === 'opencode-v2') {
    cfg.mcp.servers = cfg.mcp.servers || {};
    if (uninstall) delete cfg.mcp.servers[name]; else cfg.mcp.servers[name] = entry;
  } else {
    if (uninstall) delete cfg.mcp[name]; else cfg.mcp[name] = { ...entry, enabled: true };
  }
  next = stringify(cfg);
} else if (format === 'toml') {
  // Replace or append the [mcp_servers.<name>] table (and its [mcp_servers.<name>.env] sub-table).
  const header = `[mcp_servers.${name}]`;
  const lines = original.split('\n');
  const out = [];
  let skipping = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === header || t === `[mcp_servers.${name}.env]`) { skipping = true; continue; }
    if (skipping && /^\[/.test(t)) skipping = false;
    if (!skipping) out.push(line);
  }
  let text = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  if (!uninstall) {
    const q = s => JSON.stringify(s); // TOML basic strings share JSON escaping for these values
    let block = `${header}\ncommand = ${q(nodeBin)}\nargs = [${q(serverJs)}]\n`;
    if (hasEnv) block += `\n[mcp_servers.${name}.env]\n` + Object.entries(env).map(([k, v]) => `${k} = ${q(v)}`).join('\n') + '\n';
    text = (text ? text + '\n\n' : '') + block;
  } else if (text) text += '\n';
  next = text;
} else if (format === 'goose-yaml') {
  // Map-style `extensions:` block as written by current Goose releases.
  const lines = original.split('\n');
  const extIdx = lines.findIndex(l => /^extensions:\s*$/.test(l));
  const q = s => JSON.stringify(s);
  const block = [
    `  ${name}:`,
    `    enabled: true`,
    `    type: stdio`,
    `    name: ${name}`,
    `    description: GBIF biodiversity data (species, occurrences, datasets, literature)`,
    `    cmd: ${q(nodeBin)}`,
    `    args:`,
    `    - ${q(serverJs)}`,
    `    envs:${hasEnv ? '' : ' {}'}`,
    ...Object.entries(env).map(([k, v]) => `      ${k}: ${q(v)}`),
    `    env_keys: []`,
    `    timeout: 300`,
    `    bundled: null`,
  ];
  let out;
  if (extIdx === -1) {
    out = lines.join('\n').replace(/\s+$/, '');
    if (!uninstall) out = (out ? out + '\n' : '') + 'extensions:\n' + block.join('\n') + '\n';
    else out += out ? '\n' : '';
  } else {
    // Extent of the extensions block: following lines that are blank or indented.
    let end = extIdx + 1;
    while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end++;
    const body = lines.slice(extIdx + 1, end);
    // Remove an existing entry for this name (its line plus deeper-indented lines).
    const kept = [];
    let skipping = false;
    for (const l of body) {
      if (new RegExp(`^  ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*$`).test(l)) { skipping = true; continue; }
      if (skipping && /^  \S/.test(l)) skipping = false;
      if (skipping && l === '') continue;
      if (!skipping) kept.push(l);
    }
    while (kept.length && kept[kept.length - 1] === '') kept.pop();
    const newBody = uninstall ? kept : kept.concat(block);
    out = lines.slice(0, extIdx + 1).concat(newBody, [''], lines.slice(end)).join('\n').replace(/\n{3,}/g, '\n\n');
    if (!out.endsWith('\n')) out += '\n';
  }
  next = out;
} else {
  console.error('unknown format ' + format); process.exit(2);
}

if (next === original) { console.log(`  = ${file} already up to date`); process.exit(0); }
if (uninstall && !exists) { console.log(`  = ${file} does not exist; nothing to remove`); process.exit(0); }
if (dry) {
  console.log(`  ~ would ${uninstall ? 'remove the entry from' : 'write'} ${file}${exists ? '' : ' (new file)'}:`);
  let shown;
  if (uninstall) {
    shown = '(entry "' + name + '" removed; everything else kept)';
  } else if (format === 'toml') {
    // Show the [mcp_servers.<name>] table and its env sub-table (they are the tail of the file).
    const ls = next.split('\n');
    const start = ls.findIndex(l => l.trim() === `[mcp_servers.${name}]`);
    shown = ls.slice(Math.max(0, start)).join('\n').trimEnd();
  } else if (format === 'goose-yaml') {
    // Show just this extension's block.
    const ls = next.split('\n');
    const start = ls.findIndex(l => l === `  ${name}:`);
    let end = start + 1;
    while (end < ls.length && /^    /.test(ls[end])) end++;
    shown = ls.slice(Math.max(0, start), end).join('\n');
  } else {
    // JSON: show only the server entry, not the rest of the user's config.
    const cfg = JSON.parse(next);
    const entry = format === 'opencode-v2' ? { mcp: { servers: { [name]: cfg.mcp.servers[name] } } }
      : format === 'opencode-v1' ? { mcp: { [name]: cfg.mcp[name] } }
      : { mcpServers: { [name]: cfg.mcpServers[name] } };
    shown = JSON.stringify(entry, null, 2) + (exists ? '\n(merged into the existing file; other settings kept)' : '');
  }
  console.log(shown.split('\n').map(l => '      ' + l).join('\n'));
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (exists) fs.copyFileSync(file, file + '.bak');
  fs.writeFileSync(file, next);
  console.log(`  ✔ ${uninstall ? 'removed from' : 'wrote'} ${file}${exists ? ' (backup: ' + path.basename(file) + '.bak)' : ''}`);
}
JS
}

# ---------------------------------------------------------------- per-agent installers
install_claude() {
  log "Claude Code"
  if have claude && [[ $PREFER_FILES -eq 0 ]]; then
    local scope="$SCOPE"
    if [[ $UNINSTALL -eq 1 ]]; then
      run claude mcp remove --scope "$scope" "$SERVER_NAME" || warn "not registered in scope $scope"
    else
      # `-e` is variadic in the claude CLI, so it must come after the server name.
      local args=(claude mcp add --scope "$scope" "$SERVER_NAME")
      for kv in "${SERVER_ENV[@]:-}"; do [[ -n "$kv" ]] && args+=(-e "$kv"); done
      args+=(-- "$NODE_BIN" "$SERVER_JS")
      if claude mcp get "$SERVER_NAME" >/dev/null 2>&1; then
        say "already registered; replacing"
        [[ $DRY_RUN -eq 0 ]] && claude mcp remove --scope "$scope" "$SERVER_NAME" >/dev/null 2>&1 || true
      fi
      run "${args[@]}"
    fi
  else
    warn "claude CLI not found; install Claude Code, then run: claude mcp add --scope user $SERVER_NAME -- $NODE_BIN $SERVER_JS"
  fi
}

install_claude_desktop() {
  log "Claude Desktop ($CLAUDE_DESKTOP_CFG)"
  if [[ $SCOPE == project ]]; then say "Claude Desktop has no project scope; writing user config"; fi
  edit_config claude-json "$CLAUDE_DESKTOP_CFG"
  [[ $UNINSTALL -eq 0 && $DRY_RUN -eq 0 ]] && say "restart Claude Desktop to load the server"
  return 0
}

install_codex() {
  local cfg="$CODEX_USER_CFG"; [[ $SCOPE == project ]] && cfg="$CODEX_PROJECT_CFG"
  log "Codex CLI ($cfg)"
  if have codex && [[ $PREFER_FILES -eq 0 && $SCOPE == user ]]; then
    if [[ $UNINSTALL -eq 1 ]]; then
      run codex mcp remove "$SERVER_NAME" || warn "not registered"
    else
      local args=(codex mcp add "$SERVER_NAME")
      for kv in "${SERVER_ENV[@]:-}"; do [[ -n "$kv" ]] && args+=(--env "$kv"); done
      args+=(-- "$NODE_BIN" "$SERVER_JS")
      if codex mcp get "$SERVER_NAME" >/dev/null 2>&1; then
        say "already registered; replacing"
        [[ $DRY_RUN -eq 0 ]] && codex mcp remove "$SERVER_NAME" >/dev/null 2>&1 || true
      fi
      run "${args[@]}"
    fi
  else
    edit_config toml "$cfg"
  fi
}

install_gemini() {
  local cfg="$GEMINI_USER_CFG"; [[ $SCOPE == project ]] && cfg="$GEMINI_PROJECT_CFG"
  log "Gemini CLI ($cfg)"
  if have gemini && [[ $PREFER_FILES -eq 0 ]]; then
    if [[ $UNINSTALL -eq 1 ]]; then
      run gemini mcp remove --scope "$SCOPE" "$SERVER_NAME" || warn "not registered in scope $SCOPE"
    else
      local args=(gemini mcp add --scope "$SCOPE" --transport stdio)
      for kv in "${SERVER_ENV[@]:-}"; do [[ -n "$kv" ]] && args+=(-e "$kv"); done
      args+=("$SERVER_NAME" "$NODE_BIN" "$SERVER_JS")
      run "${args[@]}"
    fi
  else
    edit_config gemini-json "$cfg"
  fi
}

install_goose() {
  log "Goose ($GOOSE_CFG)"
  if [[ $SCOPE == project ]]; then say "Goose has no project scope; writing user config"; fi
  edit_config goose-yaml "$GOOSE_CFG"
  [[ $UNINSTALL -eq 0 && $DRY_RUN -eq 0 ]] && say "restart Goose (Desktop) or start a new session (CLI) to load the extension"
  return 0
}

install_opencode() {
  local cfg
  if [[ $SCOPE == project ]]; then
    cfg="$PWD/opencode.json"; [[ -f "$PWD/opencode.jsonc" ]] && cfg="$PWD/opencode.jsonc"
  else
    cfg="$OPENCODE_USER_DIR/opencode.json"; [[ -f "$OPENCODE_USER_DIR/opencode.jsonc" ]] && cfg="$OPENCODE_USER_DIR/opencode.jsonc"
  fi
  # OpenCode 2.x nests servers under mcp.servers; 1.x keys them directly under mcp.
  local fmt="opencode-v2"
  if have opencode; then
    local major; major="$(opencode --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
    [[ -n "$major" && "$major" -lt 2 ]] && fmt="opencode-v1"
  fi
  log "OpenCode ($cfg, ${fmt#opencode-} schema)"
  edit_config "$fmt" "$cfg"
}

# ---------------------------------------------------------------- choose agents
detect_agents() {
  local found=()
  have claude && found+=(claude)
  [[ -f "$CLAUDE_DESKTOP_CFG" || -d "$(dirname "$CLAUDE_DESKTOP_CFG")" ]] && found+=(claude-desktop)
  { have codex || [[ -f "$CODEX_USER_CFG" ]]; } && found+=(codex)
  { have gemini || [[ -f "$GEMINI_USER_CFG" ]]; } && found+=(gemini)
  { have goose || [[ -f "$GOOSE_CFG" ]]; } && found+=(goose)
  { have opencode || [[ -d "$OPENCODE_USER_DIR" ]]; } && found+=(opencode)
  printf '%s\n' "${found[@]:-}"
}

ALL_AGENTS=(claude claude-desktop codex gemini goose opencode)
if [[ -z "$AGENTS" ]]; then
  SELECTED=($(detect_agents))
  if [[ ${#SELECTED[@]} -eq 0 || -z "${SELECTED[0]}" ]]; then
    echo "No supported agents detected. Use --agents to pick from: ${ALL_AGENTS[*]}" >&2
    exit 1
  fi
  log "Detected agents: ${SELECTED[*]}"
elif [[ "$AGENTS" == all ]]; then
  SELECTED=("${ALL_AGENTS[@]}")
else
  IFS=',' read -r -a SELECTED <<<"$AGENTS"
fi

log "Server: $SERVER_NAME -> $NODE_BIN $SERVER_JS"
[[ $DRY_RUN -eq 1 ]] && log "(dry run: nothing will be written)"
[[ $UNINSTALL -eq 1 ]] && log "(uninstall mode)"
echo

FAILED=()
for agent in "${SELECTED[@]}"; do
  case "$agent" in
    claude)         install_claude ;;
    claude-desktop) install_claude_desktop ;;
    codex)          install_codex ;;
    gemini)         install_gemini ;;
    goose)          install_goose ;;
    opencode)       install_opencode ;;
    *) warn "unknown agent '$agent' (choose from: ${ALL_AGENTS[*]})"; FAILED+=("$agent") ;;
  esac || FAILED+=("$agent")
  echo
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "Finished with problems for: ${FAILED[*]}" >&2
  exit 1
fi
if [[ $UNINSTALL -eq 0 && $DRY_RUN -eq 0 ]]; then
  log "Done. Ask your agent to \"search GBIF for Puma concolor occurrences in Oregon\" to try it."
fi
