# Complete Tool Reference

Comprehensive reference for all 59 GBIF MCP tools.

## Species Tools (14)

### Core Species Operations

#### `gbif_species_search`

Search for species in the GBIF taxonomic backbone.

**Parameters:**
- `q` (string, optional) - Search query
- `rank` (enum, optional) - KINGDOM, PHYLUM, CLASS, ORDER, FAMILY, GENUS, SPECIES
- `status` (array, optional) - ACCEPTED, DOUBTFUL, SYNONYM
- `habitat` (array, optional) - MARINE, FRESHWATER, TERRESTRIAL
- `threat` (array, optional) - IUCN status (EX, CR, EN, VU, NT, LC, DD)
- `limit` (number, default: 20) - Results per page
- `offset` (number, default: 0) - Pagination offset

**Example:**
```json
{
  "q": "Panthera",
  "rank": "GENUS",
  "limit": 10
}
```

---

#### `gbif_species_get`

Get detailed species information by GBIF key.

**Parameters:**
- `key` (number, required) - GBIF species key

**Example:**
```json
{"key": 5231190}
```

---

#### `gbif_species_match`

Fuzzy match scientific names to GBIF backbone.

**Parameters:**
- `name` (string, required) - Scientific name to match
- `strict` (boolean, optional) - Exact matching only

---

#### `gbif_species_suggest`

Get autocomplete suggestions for species names.

**Parameters:**
- `q` (string, required) - Query string
- `limit` (number, default: 10) - Max suggestions

---

### Species Relationships

#### `gbif_species_children`

Get direct child taxa (e.g., species under genus).

**Parameters:**
- `key` (number, required) - Parent taxon key
- `limit`, `offset` - Pagination

---

#### `gbif_species_parents`

Get complete higher classification (kingdom → species).

**Parameters:**
- `key` (number, required) - Species key

---

#### `gbif_species_related`

Get related species (siblings, variants).

**Parameters:**
- `key` (number, required) - Species key
- `limit`, `offset` - Pagination

---

#### `gbif_species_synonyms`

Get all synonyms for a species.

**Parameters:**
- `key` (number, required) - Species key
- `limit`, `offset` - Pagination

---

### Species Information

#### `gbif_species_vernacular_names`

Get common names in all languages.

**Parameters:**
- `key` (number, required) - Species key
- `language` (string, optional) - ISO 639-1 language code
- `limit`, `offset` - Pagination

---

#### `gbif_species_descriptions`

Get textual species descriptions.

**Parameters:**
- `key` (number, required) - Species key
- `limit`, `offset` - Pagination

---

#### `gbif_species_distributions`

Get geographic distribution information.

**Parameters:**
- `key` (number, required) - Species key
- `limit`, `offset` - Pagination

---

#### `gbif_species_media`

Get images and multimedia.

**Parameters:**
- `key` (number, required) - Species key
- `limit`, `offset` - Pagination

---

### Species Analytics

#### `gbif_species_metrics`

Get quick occurrence statistics for a species.

**Parameters:**
- `key` (number, required) - Species key

**Returns:** Occurrence counts, dataset counts, geographic spread

---

#### `gbif_species_parse_names`

Parse and standardize scientific names (batch processing).

**Parameters:**
- `names` (array of strings, required) - Names to parse (max: 1000)

**Returns:** Parsed components (genus, species, authorship, year, rank)

**Example:**
```json
{
  "names": [
    "Panthera leo (Linnaeus, 1758)",
    "Puma concolor",
    "Quercus robur L."
  ]
}
```

---

## Occurrence Tools (15)

### Core Occurrence Operations

#### `gbif_occurrence_search`

Search occurrence records with extensive filtering.

**Parameters:**
- Taxonomic: `taxonKey`, `scientificName`, `kingdomKey`, etc.
- Geographic: `country`, `continent`, `decimalLatitude`, `decimalLongitude`, `geometry`
- Temporal: `year`, `month`, `eventDate`
- Quality: `hasCoordinate`, `hasGeospatialIssue`, `issue`
- Data: `datasetKey`, `publishingOrg`, `basisOfRecord`
- Pagination: `limit`, `offset`

---

#### `gbif_occurrence_get`

Get single occurrence by key.

**Parameters:**
- `key` (number, required) - Occurrence key

---

#### `gbif_occurrence_count`

Fast count of matching occurrences.

**Parameters:** Same filters as search

---

#### `gbif_occurrence_verbatim`

Get original, unprocessed occurrence data.

**Parameters:**
- `key` (number, required) - Occurrence key

---

### Download Operations

#### `gbif_occurrence_download_request`

Request large dataset download (requires auth).

**Parameters:**
- `creator` (string, optional) - GBIF username; defaults to `GBIF_USERNAME`
- `predicate` (object, required) - Download filters
- `format` (enum, optional) - DWCA, SIMPLE_CSV, SPECIES_LIST
- `notificationAddresses` (array, optional) - Email notifications

---

#### `gbif_occurrence_download_status`

Check download job status.

**Parameters:**
- `downloadKey` (string, required) - Download ID

---

#### `gbif_occurrence_download_list`

List your past downloads, newest first, with key, status, record count, filter summary, DOI and download link (requires auth).

**Parameters:**
- `username` (string, optional) - GBIF username; defaults to `GBIF_USERNAME` (GBIF only lists the authenticated account's downloads)
- `status` (array, optional) - Only these states, e.g. `["SUCCEEDED"]`
- `limit` (number, optional) - 1-100, default 20
- `offset` (number, optional) - Skip this many, default 0

---

#### `gbif_occurrence_download_predicate_builder`

Helper to build download predicates.

---

### Statistics Suite (7 tools)

#### `gbif_occurrence_counts_by_basis_of_record`

Breakdown by observation type (specimens, observations, etc.).

**Returns:** `{ "HUMAN_OBSERVATION": 1000, "PRESERVED_SPECIMEN": 500, ... }`

---

#### `gbif_occurrence_counts_by_year`

Temporal trends year-by-year.

**Returns:** `{ "2020": 100, "2021": 150, "2022": 200, ... }`

---

#### `gbif_occurrence_counts_by_country`

Geographic distribution by country.

**Returns:** `{ "US": 5000, "BR": 3000, "KE": 2000, ... }`

---

#### `gbif_occurrence_counts_by_publishing_country`

Data provider countries.

**Returns:** Country codes with counts

---

#### `gbif_occurrence_counts_by_dataset`

Dataset contribution analysis.

**Returns:** `{ "dataset-uuid": 10000, ... }`

---

#### `gbif_occurrence_counts_by_taxon`

Taxonomic composition.

**Returns:** `{ "taxonKey": count, ... }`

---

#### `gbif_occurrence_counts_by_publishing_org`

Institutional contributions.

**Returns:** `{ "org-uuid": count, ... }`

---

## Registry Tools (18)

### Datasets

- `gbif_registry_search_datasets` - Find datasets by type/keyword
- `gbif_registry_get_dataset` - Get complete metadata
- `gbif_registry_dataset_metrics` - Occurrence statistics
- `gbif_registry_dataset_document` - EML metadata (XML)

### Organizations

- `gbif_registry_search_organizations` - Find data publishers
- `gbif_registry_get_organization` - Organization details
- `gbif_registry_organization_datasets` - Org's dataset catalog

### Networks

- `gbif_registry_search_networks` - Find collaborative networks
- `gbif_registry_get_network` - Network details
- `gbif_registry_network_datasets` - Network constituents

### Infrastructure

- `gbif_registry_search_installations` - Find IPT servers
- `gbif_registry_get_installation` - Installation details

### GRSciColl

- `gbif_registry_search_collections` - Natural history collections
- `gbif_registry_get_collection` - Collection metadata
- `gbif_registry_search_institutions` - Scientific institutions
- `gbif_registry_get_institution` - Institution details

### Governance

- `gbif_registry_list_nodes` - GBIF participant nodes
- `gbif_registry_get_node` - Node details

---

## Maps Tools (4)

- `gbif_maps_get_tile_url` - Generate tile URLs (with filters)
- `gbif_maps_get_vector_tile_url` - MVT vector tiles
- `gbif_maps_get_raster_tile_url` - PNG raster tiles
- `gbif_maps_list_styles` - Available color schemes

---

## Literature Tools (2)

- `gbif_literature_search` - Find publications citing GBIF
- `gbif_literature_get` - Get publication by DOI

---

## Vocabularies Tools (3)

- `gbif_vocabularies_list` - All controlled vocabularies
- `gbif_vocabularies_get` - Get specific vocabulary
- `gbif_vocabularies_get_concept` - Get concept definition

---

## Validator Tools (3)

- `gbif_validator_validate_dwca` - Validate Darwin Core Archives
- `gbif_validator_validate_tabular` - Validate CSV/TSV files
- `gbif_validator_get_status` - Check validation job status

---

## Tool Naming Convention

All tools follow consistent naming:

```
gbif_{category}_{action}_{optional_specifier}
```

**Examples:**
- `gbif_species_search` - Search species
- `gbif_occurrence_counts_by_year` - Occurrence counts broken down by year
- `gbif_registry_search_datasets` - Search registry for datasets

## Response Format

All tools return standardized responses:

```json
{
  "success": true,
  "data": { /* tool-specific data */ },
  "metadata": {
    "tool": "tool_name",
    "timestamp": "ISO 8601 timestamp",
    /* additional context */
  }
}
```

## Parameter Types

### Common Types

- **UUID** - String in format: `"550e8400-e29b-41d4-a716-446655440000"`
- **ISO Country Code** - 2-letter code: `"US"`, `"BR"`, `"KE"`
- **Year Range** - Single `"2024"` or range `"2020,2024"`
- **Coordinates** - Decimal degrees: `-90` to `90` (lat), `-180` to `180` (lon)
- **WKT Geometry** - Well-Known Text: `"POLYGON((...))"`

### Enumerations

Common enum values used across tools:

**Rank:** KINGDOM, PHYLUM, CLASS, ORDER, FAMILY, GENUS, SPECIES, SUBSPECIES

**Basis of Record:** HUMAN_OBSERVATION, PRESERVED_SPECIMEN, FOSSIL_SPECIMEN, LIVING_SPECIMEN, MACHINE_OBSERVATION, MATERIAL_SAMPLE

**Dataset Type:** OCCURRENCE, CHECKLIST, SAMPLING_EVENT, METADATA

**Continent:** AFRICA, ANTARCTICA, ASIA, EUROPE, NORTH_AMERICA, OCEANIA, SOUTH_AMERICA

## Getting Help

- Check specific tool guides for detailed examples
- See [Examples](../examples/basic-queries.md) for real-world usage
- Review [Developer Guide](../ARCHITECTURE.md) for technical details
- Browse [GBIF API Documentation](https://www.gbif.org/developer/summary) for endpoint details
