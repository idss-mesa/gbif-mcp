import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const outPath = process.argv[2] ?? 'TOOLS.md';
const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {}, 'io.modelcontextprotocol/clientInfo': { name: 'gen-tools-md', version: '0' } } } });
const run = spawnSync(process.execPath, ['build/index.js'], { input: req + '\n', env: { ...process.env, LOG_LEVEL: 'error' }, encoding: 'utf8' });
if (run.status !== 0) throw new Error('server exited ' + run.status + ': ' + run.stderr);
const tools = JSON.parse(run.stdout.trim().split('\n').pop()).result.tools;
const cats = [
  ['species', 'Species', 'Taxonomic backbone: search, matching, name parsing, classification, names, descriptions, media and per-species statistics.'],
  ['occurrence', 'Occurrence', 'Occurrence records: search, single records, counts and faceted breakdowns, and asynchronous downloads. All "counts by" tools use faceted search (`/occurrence/search?limit=0&facet=…`), so every search filter applies to them.'],
  ['registry', 'Registry', 'Datasets, publishing organizations, networks, installations, participant nodes and GRSciColl collections and institutions.'],
  ['maps', 'Maps', 'Build GBIF map tile URLs (vector or raster density maps) for any occurrence filter. The tools return URLs, not image bytes.'],
  ['literature', 'Literature', 'Peer-reviewed papers and reports that cite GBIF-mediated data.'],
  ['vocabularies', 'Vocabularies', 'GBIF controlled vocabularies and their concepts.'],
  ['validator', 'Validator', 'Submit Darwin Core archives or tabular files to the GBIF data validator and poll the result. These tools create jobs on GBIF and are not read-only.'],
];
const byCat = Object.fromEntries(cats.map(c => [c[0], tools.filter(t => t.name.startsWith(`gbif_${c[0]}_`))]));
const covered = new Set(Object.values(byCat).flat().map(t => t.name));
const stray = tools.filter(t => !covered.has(t.name));
if (stray.length) throw new Error('uncategorised: ' + stray.map(t => t.name).join(','));

const typeOf = (s) => {
  if (!s) return 'any';
  if (s.enum) return 'enum';
  if (Array.isArray(s.type)) return s.type.join(' \\| ');
  if (s.type === 'array') return `array<${typeOf(s.items)}>`;
  if (s.anyOf) return s.anyOf.map(typeOf).join(' \\| ');
  return s.type ?? 'any';
};
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const constraints = (s) => {
  const c = [];
  if (s.enum) c.push(`one of ${s.enum.map(v => `\`${v}\``).join(', ')}`);
  if (s.items?.enum) c.push(`items one of ${s.items.enum.map(v => `\`${v}\``).join(', ')}`);
  if (s.default !== undefined) c.push(`default \`${JSON.stringify(s.default)}\``);
  if (s.minimum !== undefined) c.push(`min ${s.minimum}`);
  if (s.maximum !== undefined) c.push(`max ${s.maximum}`);
  if (s.minLength !== undefined && s.minLength === s.maxLength) c.push(`${s.minLength} chars`);
  else { if (s.minLength !== undefined) c.push(`min length ${s.minLength}`); if (s.maxLength !== undefined) c.push(`max length ${s.maxLength}`); }
  if (s.format) c.push(`format ${s.format}`);
  if (s.pattern) c.push(`pattern \`${s.pattern}\``);
  return c.join('; ');
};

let md = `# GBIF MCP Server - Tool Reference

Reference for every tool exposed by the GBIF MCP Server, generated from the server's own
\`tools/list\` response (version ${JSON.parse(readFileSync('package.json','utf8')).version}, MCP 2026-07-28).
To regenerate after changing a tool, run \`npm run build\` and then \`node scripts/gen-tools-md.mjs\`.

## Overview

**Total tools: ${tools.length}**

| Category | Tools |
|---|---|
${cats.map(c => `| [${c[1]}](#${c[1].toLowerCase()}-tools) | ${byCat[c[0]].length} |`).join('\n')}

All tools share the same conventions:

- Arguments are validated against the advertised JSON Schema by the SDK, then re-validated with
  Zod inside the tool, which also applies defaults.
- Results are a single \`text\` content item holding JSON: \`{ "success": true, "data": …, "metadata": { "tool", "timestamp", … } }\`.
- Failures are tool results with \`isError: true\` and a JSON error envelope (\`{ "success": false, "error": { "code", "message", … } }\`). Unknown tools and schema violations are JSON-RPC errors (\`-32602\`).
- Paginated GBIF responses carry \`offset\`, \`limit\`, \`count\` and \`endOfRecords\`. Responses above 250 KB are truncated with pagination guidance (see README).
- Every tool carries MCP annotations. Unless noted, tools are \`readOnlyHint: true\`, \`idempotentHint: true\`, \`openWorldHint: true\`.

`;

for (const [key, title, blurb] of cats) {
  md += `---\n\n## ${title} Tools\n\n${blurb}\n\n`;
  for (const t of byCat[key]) {
    md += `### ${t.name}\n\n${t.description}\n\n`;
    const a = t.annotations ?? {};
    if (a.readOnlyHint === false) md += `**Annotations:** not read-only (\`readOnlyHint: false\`, \`idempotentHint: ${a.idempotentHint}\`). Calling it creates or changes a job on GBIF.\n\n`;
    const props = t.inputSchema?.properties ?? {};
    const req = new Set(t.inputSchema?.required ?? []);
    const names = Object.keys(props);
    if (!names.length) { md += `**Parameters:** none.\n\n`; continue; }
    md += `| Parameter | Type | Required | Description |\n|---|---|---|---|\n`;
    for (const n of names) {
      const s = props[n];
      const c = constraints(s);
      md += `| \`${n}\` | ${typeOf(s)} | ${req.has(n) ? 'yes' : 'no'} | ${esc(s.description ?? '')}${c ? ` (${esc(c)})` : ''} |\n`;
    }
    md += '\n';
  }
}

md += `---

## Calling tools over stdio

A 2026-07-28 client sends the protocol envelope in \`_meta\` on every request:

\`\`\`json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
  "name":"gbif_species_match",
  "arguments":{"name":"Puma concolor"},
  "_meta":{
    "io.modelcontextprotocol/protocolVersion":"2026-07-28",
    "io.modelcontextprotocol/clientCapabilities":{},
    "io.modelcontextprotocol/clientInfo":{"name":"example","version":"1.0"}
  }
}}
\`\`\`

2025-era clients use the classic \`initialize\` handshake first and then call \`tools/call\` without the envelope; both are served by default (\`MCP_LEGACY_CLIENTS=serve\`).

## Common workflows

1. **Resolve a name, then query occurrences.** \`gbif_species_match\` → \`usageKey\` → \`gbif_occurrence_search\` / \`gbif_occurrence_count\` with \`taxonKey\`.
2. **Profile a taxon.** \`gbif_species_get\`, \`gbif_species_vernacular_names\`, \`gbif_species_metrics\`, then \`gbif_occurrence_counts_by_country\` and \`gbif_occurrence_counts_by_year\` for coverage.
3. **Find and cite data.** \`gbif_registry_search_datasets\` → \`gbif_registry_get_dataset\` → \`gbif_registry_dataset_document\` (EML) and \`gbif_literature_search\` for papers using the dataset.
4. **Large extracts.** \`gbif_occurrence_download_predicate_builder\` → \`gbif_occurrence_download_request\` (needs \`GBIF_USERNAME\`/\`GBIF_PASSWORD\`) → \`gbif_occurrence_download_status\`.
5. **Maps.** \`gbif_maps_list_styles\` → \`gbif_maps_get_tile_url\` with the same filters as a search.

## Pagination guidelines

- Default \`limit\` is 20 for most search tools; GBIF caps occurrence search at 300 per page and at offset 100,000. Use downloads beyond that.
- Check \`endOfRecords\` rather than comparing \`offset\` with \`count\`; \`count\` is approximate for large result sets.
- Use the count and "counts by" tools before paging through large result sets.
`;
writeFileSync(outPath, md);
console.log('wrote', outPath, tools.length, 'tools', md.split('\n').length, 'lines');
