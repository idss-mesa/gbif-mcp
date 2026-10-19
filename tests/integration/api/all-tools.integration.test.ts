/**
 * Adversarial end-to-end verification of EVERY tool against the live GBIF API.
 *
 * The real server is spawned over stdio and driven with the official v2 MCP client
 * negotiating the 2026-07-28 protocol era. For each of the 59 tools:
 *
 *  - a "valid" call with known-good GBIF inputs must succeed (no `isError`) and
 *    return well-formed JSON within the response size limit;
 *  - several adversarial calls (wrong types, hostile strings, bogus identifiers,
 *    out-of-range paging, invalid enums/UUIDs/WKT) must either be rejected with a
 *    structured tool error or answered with a well-formed result, and must never
 *    crash the server or leak a protocol-level error.
 *
 * Finally the server must still be alive and serving the full tool catalogue.
 *
 * Requires network access to https://api.gbif.org. Tools needing GBIF credentials
 * (downloads, validator) are only verified for their error path.
 *
 * Run with: npm run test:integration:api
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { connectClient, parseToolText } from '../helpers/stdio-server.js';

const MAX_RESPONSE_BYTES = 250 * 1024;
const CALL_TIMEOUT_MS = 60_000;

// Known-stable GBIF identifiers
const PUMA_CONCOLOR = 2435099; // species
const PUMA_GENUS = 2435098;
const BACKBONE_DATASET = 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c';
const EBIRD_DATASET = '4fa7b334-ce0d-4e88-aaae-2e0c138d049e';
const CORNELL_ORG = 'e2e717bf-551a-4917-bdc9-4fa0f342c530';

type Expectation = 'error' | 'any';
interface Adversarial {
  label: string;
  args: Record<string, unknown>;
  expect: Expectation;
}
interface Fixtures {
  occurrenceKey?: number;
  networkKey?: string;
  installationKey?: string;
  collectionKey?: string;
  institutionKey?: string;
  nodeKey?: string;
  doi?: string;
  downloadKey?: string;
  vocabularyName?: string;
  conceptName?: string;
}
interface ToolCase {
  tool: string;
  /** Known-good arguments; a function may use fixtures discovered from earlier calls. */
  valid?: Record<string, unknown> | ((f: Fixtures) => Record<string, unknown> | undefined);
  /** Why there is no positive case (credentials, etc.). */
  validSkipReason?: string;
  adversarial: Adversarial[];
}

const HOSTILE_STRINGS = [
  "'; DROP TABLE occurrence; --",
  '../../../../etc/passwd',
  '<script>alert(1)</script>',
  '%00%0d%0a',
  '🦉'.repeat(50),
  'a'.repeat(5000),
];

const paging = (): Adversarial[] => [
  { label: 'negative offset', args: { offset: -1 }, expect: 'error' },
  { label: 'zero limit', args: { limit: 0 }, expect: 'error' },
  { label: 'absurd limit', args: { limit: 10_000_000 }, expect: 'error' },
  { label: 'string limit', args: { limit: 'ten' }, expect: 'error' },
];
const hostileQ = (): Adversarial[] =>
  HOSTILE_STRINGS.map((q, i) => ({ label: `hostile q #${i + 1}`, args: { q, limit: 1 }, expect: 'any' as const }));
const badKey = (field = 'key'): Adversarial[] => [
  { label: `${field} missing`, args: {}, expect: 'error' },
  { label: `${field} wrong type`, args: { [field]: 'abc' }, expect: 'error' },
  { label: `${field} negative`, args: { [field]: -5 }, expect: 'error' },
  { label: `${field} nonexistent`, args: { [field]: 999_999_999_999 }, expect: 'error' },
  { label: `${field} float`, args: { [field]: 1.5 }, expect: 'error' },
];
const badUuid = (field = 'key'): Adversarial[] => [
  { label: `${field} missing`, args: {}, expect: 'error' },
  { label: `${field} not a uuid`, args: { [field]: 'not-a-uuid' }, expect: 'error' },
  { label: `${field} hostile`, args: { [field]: HOSTILE_STRINGS[1] }, expect: 'error' },
  { label: `${field} nonexistent uuid`, args: { [field]: '00000000-0000-0000-0000-000000000000' }, expect: 'error' },
  { label: `${field} wrong type`, args: { [field]: 12345 }, expect: 'error' },
];
const taxonFilters = (): Adversarial[] => [
  { label: 'taxonKey wrong type', args: { taxonKey: 'Puma' }, expect: 'error' },
  { label: 'nonexistent taxonKey', args: { taxonKey: 999_999_999 }, expect: 'any' },
  { label: 'bogus country code', args: { country: 'ZZZZ' }, expect: 'any' },
  { label: 'hostile country', args: { country: HOSTILE_STRINGS[0] }, expect: 'any' },
  { label: 'year out of range', args: { year: '99999' }, expect: 'any' },
  { label: 'unknown extra argument', args: { taxonKey: PUMA_CONCOLOR, thisIsNotAParameter: true }, expect: 'any' },
];

const CASES: ToolCase[] = [
  // ---------------------------------------------------------------- species
  { tool: 'gbif_species_search', valid: { q: 'Puma concolor', limit: 2 }, adversarial: [...hostileQ(), ...paging(),
    { label: 'invalid rank enum', args: { q: 'Puma', rank: 'EMPEROR' }, expect: 'error' },
    { label: 'status not an array', args: { q: 'Puma', status: 'ACCEPTED' }, expect: 'error' },
    { label: 'facetMincount zero', args: { q: 'Puma', facet: ['rank'], facetMincount: 0 }, expect: 'error' }] },
  { tool: 'gbif_species_get', valid: { key: PUMA_CONCOLOR }, adversarial: badKey() },
  { tool: 'gbif_species_suggest', valid: { q: 'Puma conc', limit: 3 }, adversarial: [
    { label: 'q missing', args: {}, expect: 'error' },
    { label: 'q empty', args: { q: '' }, expect: 'any' },
    ...hostileQ()] },
  { tool: 'gbif_species_match', valid: { name: 'Puma concolor' }, adversarial: [
    { label: 'name missing', args: {}, expect: 'error' },
    { label: 'name wrong type', args: { name: 42 }, expect: 'error' },
    { label: 'nonsense name', args: { name: 'Zzzzzz qqqqqq' }, expect: 'any' },
    { label: 'hostile name', args: { name: HOSTILE_STRINGS[0] }, expect: 'any' },
    { label: 'strict wrong type', args: { name: 'Puma concolor', strict: 'yes' }, expect: 'error' }] },
  { tool: 'gbif_species_vernacular_names', valid: { key: PUMA_CONCOLOR, limit: 2 }, adversarial: [...badKey(), ...paging().map(a => ({ ...a, args: { key: PUMA_CONCOLOR, ...a.args } }))] },
  { tool: 'gbif_species_synonyms', valid: { key: PUMA_CONCOLOR, limit: 2 }, adversarial: badKey() },
  { tool: 'gbif_species_children', valid: { key: PUMA_GENUS, limit: 2 }, adversarial: badKey() },
  { tool: 'gbif_species_parents', valid: { key: PUMA_CONCOLOR }, adversarial: badKey() },
  { tool: 'gbif_species_descriptions', valid: { key: PUMA_CONCOLOR, limit: 2 }, adversarial: badKey() },
  { tool: 'gbif_species_distributions', valid: { key: PUMA_CONCOLOR, limit: 2 }, adversarial: badKey() },
  { tool: 'gbif_species_media', valid: { key: PUMA_CONCOLOR, limit: 2 }, adversarial: badKey() },
  { tool: 'gbif_species_metrics', valid: { key: PUMA_CONCOLOR }, adversarial: badKey() },
  { tool: 'gbif_species_parse_names', valid: { names: ['Puma concolor (Linnaeus, 1771)', 'Quercus alba L.'] }, adversarial: [
    { label: 'names missing', args: {}, expect: 'error' },
    { label: 'names not an array', args: { names: 'Puma concolor' }, expect: 'error' },
    { label: 'names empty array', args: { names: [] }, expect: 'any' },
    { label: 'hostile names', args: { names: HOSTILE_STRINGS }, expect: 'any' },
    { label: 'names with non-strings', args: { names: [1, null, {}] }, expect: 'error' }] },
  { tool: 'gbif_species_related', valid: { key: PUMA_CONCOLOR, limit: 2 }, adversarial: badKey() },
  // ------------------------------------------------------------- occurrence
  { tool: 'gbif_occurrence_search', valid: { taxonKey: PUMA_CONCOLOR, country: 'US', hasCoordinate: true, limit: 2 }, adversarial: [...hostileQ(), ...paging(), ...taxonFilters(),
    { label: 'invalid WKT geometry', args: { geometry: 'POLYGON((not wkt))', limit: 1 }, expect: 'any' },
    { label: 'latitude out of range', args: { decimalLatitude: '-999,999', limit: 1 }, expect: 'any' },
    { label: 'invalid basisOfRecord', args: { basisOfRecord: ['NOT_A_BASIS'], limit: 1 }, expect: 'error' },
    { label: 'hasCoordinate wrong type', args: { hasCoordinate: 'maybe' }, expect: 'error' }] },
  { tool: 'gbif_occurrence_get', valid: f => f.occurrenceKey ? { key: f.occurrenceKey } : undefined, adversarial: badKey() },
  { tool: 'gbif_occurrence_count', valid: { taxonKey: PUMA_CONCOLOR, country: 'US' }, adversarial: [...taxonFilters(),
    { label: 'invalid WKT geometry', args: { geometry: 'POLYGON((1 1))' }, expect: 'any' }] },
  { tool: 'gbif_occurrence_download_request', validSkipReason: 'requires GBIF credentials', adversarial: [
    { label: 'creator missing', args: { predicate: { type: 'equals', key: 'TAXON_KEY', value: '2435099' } }, expect: 'error' },
    { label: 'unauthenticated request', args: { creator: 'nobody', predicate: { type: 'equals', key: 'TAXON_KEY', value: '2435099' } }, expect: 'error' },
    { label: 'invalid format enum', args: { creator: 'nobody', format: 'XLSX', predicate: {} }, expect: 'error' },
    { label: 'bad notification email', args: { creator: 'nobody', notificationAddresses: ['not-an-email'], predicate: {} }, expect: 'error' }] },
  { tool: 'gbif_occurrence_download_predicate_builder', valid: { taxonKey: PUMA_CONCOLOR, country: 'US', year: '2000,2020', hasCoordinate: true }, adversarial: [
    { label: 'no filters at all', args: {}, expect: 'any' },
    { label: 'taxonKey wrong type', args: { taxonKey: 'Puma' }, expect: 'error' },
    { label: 'hostile scientificName', args: { scientificName: HOSTILE_STRINGS[0] }, expect: 'any' }] },
  { tool: 'gbif_occurrence_download_status', valid: f => f.downloadKey ? { downloadKey: f.downloadKey } : undefined, adversarial: [
    { label: 'downloadKey missing', args: {}, expect: 'error' },
    { label: 'nonexistent downloadKey', args: { downloadKey: '0000000-000000000000000' }, expect: 'error' },
    { label: 'hostile downloadKey', args: { downloadKey: HOSTILE_STRINGS[1] }, expect: 'error' },
    { label: 'downloadKey wrong type', args: { downloadKey: 123 }, expect: 'error' }] },
  { tool: 'gbif_occurrence_download_list', validSkipReason: 'requires GBIF credentials', adversarial: [
    { label: 'no credentials configured', args: {}, expect: 'error' },
    { label: "another user's downloads", args: { username: 'gbif' }, expect: 'error' },
    { label: 'invalid status enum', args: { status: ['DONE'] }, expect: 'error' },
    { label: 'limit out of range', args: { limit: 1000 }, expect: 'error' },
    { label: 'hostile username', args: { username: HOSTILE_STRINGS[1] }, expect: 'error' }] },
  { tool: 'gbif_occurrence_verbatim', valid: f => f.occurrenceKey ? { key: f.occurrenceKey } : undefined, adversarial: badKey() },
  { tool: 'gbif_occurrence_counts_by_basis_of_record', valid: { taxonKey: PUMA_CONCOLOR }, adversarial: taxonFilters() },
  { tool: 'gbif_occurrence_counts_by_year', valid: { taxonKey: PUMA_CONCOLOR, country: 'US' }, adversarial: taxonFilters() },
  { tool: 'gbif_occurrence_counts_by_country', valid: { taxonKey: PUMA_CONCOLOR }, adversarial: taxonFilters() },
  { tool: 'gbif_occurrence_counts_by_publishing_country', valid: { taxonKey: PUMA_CONCOLOR }, adversarial: taxonFilters() },
  { tool: 'gbif_occurrence_counts_by_dataset', valid: { taxonKey: PUMA_CONCOLOR }, adversarial: taxonFilters() },
  { tool: 'gbif_occurrence_counts_by_taxon', valid: { taxonKey: PUMA_GENUS }, adversarial: taxonFilters() },
  { tool: 'gbif_occurrence_counts_by_publishing_org', valid: { taxonKey: PUMA_CONCOLOR }, adversarial: taxonFilters() },
  // --------------------------------------------------------------- registry
  { tool: 'gbif_registry_search_datasets', valid: { q: 'birds', type: 'OCCURRENCE', limit: 2 }, adversarial: [...hostileQ(), ...paging(),
    { label: 'invalid type enum', args: { type: 'SPREADSHEET' }, expect: 'error' },
    { label: 'invalid publishingOrg uuid', args: { publishingOrg: 'nope' }, expect: 'any' }] },
  { tool: 'gbif_registry_get_dataset', valid: { key: EBIRD_DATASET }, adversarial: badUuid() },
  { tool: 'gbif_registry_dataset_metrics', valid: { key: BACKBONE_DATASET }, adversarial: badUuid() },
  { tool: 'gbif_registry_dataset_document', valid: { key: EBIRD_DATASET }, adversarial: badUuid() },
  { tool: 'gbif_registry_search_organizations', valid: { q: 'Cornell', limit: 2 }, adversarial: [...hostileQ(), ...paging(),
    { label: 'isEndorsed wrong type', args: { isEndorsed: 'yes' }, expect: 'error' }] },
  { tool: 'gbif_registry_get_organization', valid: { key: CORNELL_ORG }, adversarial: badUuid() },
  { tool: 'gbif_registry_organization_datasets', valid: { organizationKey: CORNELL_ORG, limit: 2 }, adversarial: badUuid('organizationKey') },
  { tool: 'gbif_registry_search_networks', valid: { limit: 2 }, adversarial: [...hostileQ(), ...paging()] },
  { tool: 'gbif_registry_get_network', valid: f => f.networkKey ? { key: f.networkKey } : undefined, adversarial: badUuid() },
  { tool: 'gbif_registry_network_datasets', valid: f => f.networkKey ? { networkKey: f.networkKey, limit: 2 } : undefined, adversarial: badUuid('networkKey') },
  { tool: 'gbif_registry_search_installations', valid: { limit: 2 }, adversarial: [...hostileQ(), ...paging(),
    { label: 'invalid type enum', args: { type: 'FAX_MACHINE' }, expect: 'error' }] },
  { tool: 'gbif_registry_get_installation', valid: f => f.installationKey ? { key: f.installationKey } : undefined, adversarial: badUuid() },
  { tool: 'gbif_registry_search_collections', valid: { q: 'herbarium', limit: 2 }, adversarial: [...hostileQ(), ...paging()] },
  { tool: 'gbif_registry_get_collection', valid: f => f.collectionKey ? { key: f.collectionKey } : undefined, adversarial: badUuid() },
  { tool: 'gbif_registry_search_institutions', valid: { q: 'museum', limit: 2 }, adversarial: [...hostileQ(), ...paging()] },
  { tool: 'gbif_registry_get_institution', valid: f => f.institutionKey ? { key: f.institutionKey } : undefined, adversarial: badUuid() },
  { tool: 'gbif_registry_list_nodes', valid: { limit: 2 }, adversarial: [...paging(),
    { label: 'hostile country', args: { country: HOSTILE_STRINGS[0], limit: 1 }, expect: 'any' }] },
  { tool: 'gbif_registry_get_node', valid: f => f.nodeKey ? { key: f.nodeKey } : undefined, adversarial: badUuid() },
  // ------------------------------------------------------------------- maps
  { tool: 'gbif_maps_get_tile_url', valid: { z: 2, x: 1, y: 1, taxonKey: PUMA_CONCOLOR, style: 'classic.point' }, adversarial: [
    { label: 'coordinates missing', args: {}, expect: 'error' },
    { label: 'negative zoom', args: { z: -1, x: 0, y: 0 }, expect: 'error' },
    { label: 'string coordinates', args: { z: '2', x: '1', y: '1' }, expect: 'error' },
    { label: 'tile out of range for zoom', args: { z: 1, x: 500, y: 500 }, expect: 'any' },
    { label: 'invalid format', args: { z: 1, x: 0, y: 0, format: 'bmp' }, expect: 'error' },
    { label: 'hostile style', args: { z: 1, x: 0, y: 0, style: HOSTILE_STRINGS[1] }, expect: 'any' }] },
  { tool: 'gbif_maps_get_vector_tile_url', valid: { z: 2, x: 1, y: 1, taxonKey: PUMA_CONCOLOR }, adversarial: [
    { label: 'coordinates missing', args: {}, expect: 'error' },
    { label: 'string coordinates', args: { z: '2', x: '1', y: '1' }, expect: 'error' }] },
  { tool: 'gbif_maps_get_raster_tile_url', valid: { z: 2, x: 1, y: 1, taxonKey: PUMA_CONCOLOR }, adversarial: [
    { label: 'coordinates missing', args: {}, expect: 'error' },
    { label: 'invalid scale', args: { z: 1, x: 0, y: 0, scale: '@9x' }, expect: 'error' }] },
  { tool: 'gbif_maps_list_styles', valid: {}, adversarial: [
    { label: 'unexpected arguments', args: { style: 'x', z: 1 }, expect: 'any' }] },
  // ------------------------------------------------------------- literature
  { tool: 'gbif_literature_search', valid: { q: 'biodiversity', limit: 2 }, adversarial: [...hostileQ(), ...paging(),
    { label: 'peerReview wrong type', args: { peerReview: 'yes' }, expect: 'error' },
    { label: 'year nonsense', args: { year: 'eleventy', limit: 1 }, expect: 'any' }] },
  { tool: 'gbif_literature_get', valid: f => f.doi ? { doi: f.doi } : undefined, adversarial: [
    { label: 'doi missing', args: {}, expect: 'error' },
    { label: 'doi nonexistent', args: { doi: '10.9999/does.not.exist' }, expect: 'error' },
    { label: 'doi hostile', args: { doi: HOSTILE_STRINGS[1] }, expect: 'error' },
    { label: 'doi wrong type', args: { doi: 10 }, expect: 'error' }] },
  // ----------------------------------------------------------- vocabularies
  { tool: 'gbif_vocabularies_list', valid: {}, adversarial: [
    { label: 'unexpected arguments', args: { limit: -1 }, expect: 'any' }] },
  { tool: 'gbif_vocabularies_get', valid: f => ({ name: f.vocabularyName ?? 'LifeStage' }), adversarial: [
    { label: 'name missing', args: {}, expect: 'error' },
    { label: 'name nonexistent', args: { name: 'NotARealVocabulary' }, expect: 'error' },
    { label: 'name hostile', args: { name: HOSTILE_STRINGS[1] }, expect: 'error' },
    { label: 'name wrong type', args: { name: 1 }, expect: 'error' }] },
  { tool: 'gbif_vocabularies_get_concept', valid: f => ({ vocabulary: f.vocabularyName ?? 'LifeStage', concept: f.conceptName ?? 'Adult' }), adversarial: [
    { label: 'concept missing', args: { vocabulary: 'LifeStage' }, expect: 'error' },
    { label: 'concept nonexistent', args: { vocabulary: 'LifeStage', concept: 'Zombie' }, expect: 'error' },
    { label: 'vocabulary nonexistent', args: { vocabulary: 'Nope', concept: 'Adult' }, expect: 'error' },
    { label: 'hostile', args: { vocabulary: HOSTILE_STRINGS[1], concept: HOSTILE_STRINGS[0] }, expect: 'error' }] },
  // -------------------------------------------------------------- validator
  { tool: 'gbif_validator_validate_dwca', validSkipReason: 'GBIF validator API requires credentials', adversarial: [
    { label: 'fileUrl missing', args: {}, expect: 'error' },
    { label: 'fileUrl not a url', args: { fileUrl: 'not a url' }, expect: 'error' },
    { label: 'unauthenticated submission', args: { fileUrl: 'https://example.org/archive.zip' }, expect: 'error' }] },
  { tool: 'gbif_validator_get_status', validSkipReason: 'GBIF validator API requires credentials', adversarial: [
    { label: 'validationKey missing', args: {}, expect: 'error' },
    { label: 'validationKey nonexistent', args: { validationKey: '00000000-0000-0000-0000-000000000000' }, expect: 'error' },
    { label: 'validationKey hostile', args: { validationKey: HOSTILE_STRINGS[1] }, expect: 'error' }] },
  { tool: 'gbif_validator_validate_tabular', validSkipReason: 'GBIF validator API requires credentials', adversarial: [
    { label: 'fileUrl missing', args: {}, expect: 'error' },
    { label: 'invalid fileType enum', args: { fileUrl: 'https://example.org/data.csv', fileType: 'XLSX' }, expect: 'error' },
    { label: 'unauthenticated submission', args: { fileUrl: 'https://example.org/data.csv', fileType: 'CSV' }, expect: 'error' }] },
];

let client: Client;
const fixtures: Fixtures = {};
const report: Array<{ tool: string; label: string; ok: boolean; isError: boolean; ms: number; bytes: number; note?: string }> = [];

async function call(tool: string, args: Record<string, unknown>) {
  const t0 = Date.now();
  const result: any = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS });
  const { text, json } = parseToolText(result);
  return { result, text, json, ms: Date.now() - t0, bytes: Buffer.byteLength(text, 'utf8') };
}

/** Find the first record of a paginated tool response. */
function firstRecord(json: any): any {
  const data = json?.data ?? json;
  if (Array.isArray(data)) return data[0];
  if (Array.isArray(data?.results)) return data.results[0];
  if (Array.isArray(json?.results)) return json.results[0];
  return undefined;
}

function assertWellFormed(result: any, text: string, bytes: number) {
  expect(Array.isArray(result.content)).toBe(true);
  expect(result.content[0]?.type).toBe('text');
  expect(text.length).toBeGreaterThan(0);
  expect(bytes).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
}

function assertStructuredError(result: any, text: string, json: any) {
  expect(result.isError).toBe(true);
  // Either the SDK-level JSON Schema rejection or the server's own JSON error envelope.
  if (json !== undefined) {
    expect(json.error).toBeTruthy();
    expect(typeof json.message === 'string' || typeof json.error === 'string').toBe(true);
  } else {
    expect(text).toMatch(/Input validation error|Invalid arguments/);
  }
}

beforeAll(async () => {
  client = await connectClient({ mode: 'auto' });
  expect(client.getProtocolEra()).toBe('modern');

  // Discover live identifiers for the "get by key" tools from their search counterparts.
  const occ = await call('gbif_occurrence_search', { taxonKey: PUMA_CONCOLOR, hasCoordinate: true, limit: 1 });
  fixtures.occurrenceKey = firstRecord(occ.json)?.key;
  const net = await call('gbif_registry_search_networks', { limit: 1 });
  fixtures.networkKey = firstRecord(net.json)?.key;
  const inst = await call('gbif_registry_search_installations', { limit: 1 });
  fixtures.installationKey = firstRecord(inst.json)?.key;
  const col = await call('gbif_registry_search_collections', { q: 'herbarium', limit: 1 });
  fixtures.collectionKey = firstRecord(col.json)?.key;
  const institution = await call('gbif_registry_search_institutions', { q: 'museum', limit: 1 });
  fixtures.institutionKey = firstRecord(institution.json)?.key;
  const nodes = await call('gbif_registry_list_nodes', { limit: 1 });
  fixtures.nodeKey = firstRecord(nodes.json)?.key;
  const lit = await call('gbif_literature_search', { q: 'biodiversity', peerReview: true, limit: 20 });
  const litData = lit.json?.data ?? lit.json;
  const litResults: any[] = litData?.results ?? [];
  fixtures.doi = litResults.find(r => r?.identifiers?.doi)?.identifiers?.doi;
  fixtures.downloadKey = litResults.flatMap(r => r?.gbifDownloadKey ?? [])[0];
  // LifeStage/Adult is a long-standing, stable GBIF vocabulary concept.
  fixtures.vocabularyName = 'LifeStage';
  fixtures.conceptName = 'Adult';
  console.log('Discovered fixtures:', JSON.stringify(fixtures));
}, 180_000);

afterAll(async () => {
  const failures = report.filter(r => !r.ok);
  const byTool = new Map<string, { calls: number; failed: number; ms: number }>();
  for (const r of report) {
    const t = byTool.get(r.tool) ?? { calls: 0, failed: 0, ms: 0 };
    t.calls++;
    if (!r.ok) t.failed++;
    t.ms += r.ms;
    byTool.set(r.tool, t);
  }
  console.log(`\nAdversarial matrix: ${report.length} calls across ${byTool.size} tools, ${failures.length} unexpected outcomes`);
  for (const f of failures) console.log(`  FAIL ${f.tool} [${f.label}] isError=${f.isError} ${f.note ?? ''}`);
  await client?.close();
});

describe.each(CASES)('$tool', ({ tool, valid, validSkipReason, adversarial }) => {
  const validArgs = typeof valid === 'function' ? valid : () => valid;

  it(validSkipReason ? `valid call skipped: ${validSkipReason}` : 'valid call succeeds', async ctx => {
    if (validSkipReason) return ctx.skip();
    const args = validArgs(fixtures);
    if (!args) return ctx.skip(); // fixture could not be discovered
    const { result, text, json, ms, bytes } = await call(tool, args);
    const ok = result.isError !== true && json !== undefined && json?.success !== false;
    report.push({ tool, label: 'valid', ok, isError: !!result.isError, ms, bytes, note: ok ? undefined : text.slice(0, 200) });
    assertWellFormed(result, text, bytes);
    expect(result.isError, text.slice(0, 500)).not.toBe(true);
    expect(json, 'tool output must be JSON').toBeDefined();
    if (json && 'success' in json) expect(json.success).toBe(true);
  }, CALL_TIMEOUT_MS);

  it.each(adversarial)('adversarial: $label', async ({ label, args, expect: expectation }) => {
    const { result, text, json, ms, bytes } = await call(tool, args);
    let ok = true;
    let note: string | undefined;
    try {
      assertWellFormed(result, text, bytes);
      if (expectation === 'error') assertStructuredError(result, text, json);
      else if (result.isError) assertStructuredError(result, text, json);
      else expect(json).toBeDefined();
    } catch (e) {
      ok = false;
      note = (e as Error).message.split('\n')[0] + ' :: ' + text.slice(0, 160);
      throw e;
    } finally {
      report.push({ tool, label, ok, isError: !!result.isError, ms, bytes, note });
    }
  }, CALL_TIMEOUT_MS);
});

describe('server health after the adversarial matrix', () => {
  it('still lists every tool and answers a real query', async () => {
    const list = await client.listTools();
    expect(list.tools).toHaveLength(59);
    const { result, json } = await call('gbif_species_match', { name: 'Puma concolor' });
    expect(result.isError).not.toBe(true);
    expect(json?.success).toBe(true);
  }, CALL_TIMEOUT_MS);
});
