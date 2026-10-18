# GBIF MCP Server - Tool Reference

Reference for every tool exposed by the GBIF MCP Server, generated from the server's own
`tools/list` response (version 1.1.0, MCP 2026-07-28).
To regenerate after changing a tool, run `npm run build` and then `node scripts/gen-tools-md.mjs`.

## Overview

**Total tools: 58**

| Category | Tools |
|---|---|
| [Species](#species-tools) | 14 |
| [Occurrence](#occurrence-tools) | 14 |
| [Registry](#registry-tools) | 18 |
| [Maps](#maps-tools) | 4 |
| [Literature](#literature-tools) | 2 |
| [Vocabularies](#vocabularies-tools) | 3 |
| [Validator](#validator-tools) | 3 |

All tools share the same conventions:

- Arguments are validated against the advertised JSON Schema by the SDK, then re-validated with
  Zod inside the tool, which also applies defaults.
- Results are a single `text` content item holding JSON: `{ "success": true, "data": …, "metadata": { "tool", "timestamp", … } }`.
- Failures are tool results with `isError: true` and a JSON error envelope (`{ "success": false, "error": { "code", "message", … } }`). Unknown tools and schema violations are JSON-RPC errors (`-32602`).
- Paginated GBIF responses carry `offset`, `limit`, `count` and `endOfRecords`. Responses above 250 KB are truncated with pagination guidance (see README).
- Every tool carries MCP annotations. Unless noted, tools are `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: true`.

---

## Species Tools

Taxonomic backbone: search, matching, name parsing, classification, names, descriptions, media and per-species statistics.

### gbif_species_search

Search for species in the GBIF taxonomic backbone. Supports filtering by rank, status, habitat, threat level, and more.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Simple full text search parameter. The value for this parameter can be a simple word or a phrase. Wildcards are not supported. |
| `rank` | enum | no | Filters by taxonomic rank. See https://api.gbif.org/v1/enumeration/basic/Rank for full list. Common values: KINGDOM, PHYLUM, CLASS, ORDER, FAMILY, GENUS, SPECIES, SUBSPECIES. (one of `KINGDOM`, `PHYLUM`, `CLASS`, `ORDER`, `FAMILY`, `GENUS`, `SPECIES`, `SUBSPECIES`) |
| `higherTaxonKey` | number | no | Filters by any of the higher Linnean rank keys. Note this is within the respective checklist and not searching NUB keys across all checklists. Example: 212 (for family Felidae). |
| `status` | array<enum> | no | Filters by the taxonomic status. Values: ACCEPTED (valid taxon name), DOUBTFUL (uncertain status), SYNONYM (alternative name), HETEROTYPIC_SYNONYM (different type specimens), HOMOTYPIC_SYNONYM (same type specimen). See https://api.gbif.org/v1/enumeration/basic/TaxonomicStatus (items one of `ACCEPTED`, `DOUBTFUL`, `SYNONYM`, `HETEROTYPIC_SYNONYM`, `HOMOTYPIC_SYNONYM`) |
| `isExtinct` | boolean | no | Filters by extinction status. Set to true to find only extinct species, false for extant species only. |
| `habitat` | array<enum> | no | Filters by the habitat. Currently only 3 major biomes are accepted: MARINE (ocean/sea habitats), FRESHWATER (rivers/lakes), TERRESTRIAL (land habitats). See https://api.gbif.org/v1/enumeration/basic/Habitat (items one of `MARINE`, `FRESHWATER`, `TERRESTRIAL`) |
| `threat` | array<enum> | no | Filters by IUCN threat status. Values: EX (Extinct), EW (Extinct in Wild), CR (Critically Endangered), EN (Endangered), VU (Vulnerable), NT (Near Threatened), LC (Least Concern), DD (Data Deficient), NE (Not Evaluated). See https://api.gbif.org/v1/enumeration/basic/ThreatStatus (items one of `EX`, `EW`, `CR`, `EN`, `VU`, `NT`, `LC`, `DD`, `NE`) |
| `nameType` | array<enum> | no | Filters by name type. Values: SCIENTIFIC (proper scientific names), VIRUS (virus names), HYBRID (hybrid names), INFORMAL (informal names), CULTIVAR (cultivated varieties), CANDIDATUS (proposed bacterial names), DOUBTFUL (uncertain names), PLACEHOLDER (temporary names), NO_NAME (unnamed taxa). See https://api.gbif.org/v1/enumeration/basic/NameType (items one of `WELLFORMED`, `DOUBTFUL`, `PLACEHOLDER`, `NO_NAME`, `SCIENTIFIC`, `VIRUS`, `HYBRID`, `INFORMAL`, `CULTIVAR`, `CANDIDATUS`) |
| `datasetKey` | array<string> | no | A UUID of a checklist dataset. Example: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c" (GBIF Backbone Taxonomy). Can be repeated to query multiple datasets. |
| `nomenclaturalStatus` | array<string> | no | Filters by nomenclatural status. Values include: LEGITIMATE, VALIDLY_PUBLISHED, NEW_COMBINATION, REPLACEMENT, CONSERVED, REJECTED, INVALID, etc. See https://api.gbif.org/v1/enumeration/basic/NomenclaturalStatus for complete list. |
| `issue` | array<string> | no | A specific indexing issue. Values include: BACKBONE_MATCH_NONE, BACKBONE_MATCH_FUZZY, RANK_INVALID, SCIENTIFIC_NAME_ASSEMBLED, CLASSIFICATION_NOT_APPLIED, etc. See https://api.gbif.org/v1/enumeration/basic/NameUsageIssue for full list. |
| `hl` | boolean | no | Set hl=true to highlight terms matching the query in fulltext search fields. The highlight will be an emphasis tag of class "gbifHl". |
| `facet` | array<string> | no | A facet name used to retrieve the most frequent values for a field. This parameter may be repeated to request multiple facets. Example: ["rank", "status", "habitat"] to get counts by rank, status, and habitat. |
| `facetMincount` | number | no | Used in combination with the facet parameter. Set facetMincount={#} to exclude facets with a count less than {#}. Example: facetMincount=10 to only show facet values appearing 10+ times. (min 1) |
| `facetMultiselect` | boolean | no | Used in combination with the facet parameter. Set facetMultiselect=true to still return counts for values that are not currently filtered. Useful for multi-select faceted search interfaces. |
| `offset` | number | no | Determines the offset for the search results. A limit of 20 and offset of 40 will get the third page of 20 results. Some services have a maximum offset. (default `0`; min 0) |
| `limit` | number | no | Controls the number of results in the page. Using too high a value will be overwritten with the default maximum threshold. Sensible defaults are used so this may be omitted. Maximum: 1000. (default `20`; min 1; max 1000) |

### gbif_species_get

Get detailed information about a specific species by its GBIF key.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | number | yes | The GBIF unique identifier for a species (usageKey). This is a numeric key that uniquely identifies a taxon in the GBIF backbone taxonomy. Example: 5219404 (Panthera leo - African lion). |

### gbif_species_suggest

Get species name suggestions for autocomplete functionality.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | Partial species name for autocomplete suggestions. Minimum 2 characters required. Example: "Pant" to get suggestions like "Panthera", "Panthera leo", etc. (min length 2) |
| `limit` | number | no | Maximum number of suggestions to return. Controls the number of autocomplete results. Range: 1-100, default: 10. (default `10`; min 1; max 100) |

### gbif_species_match

Fuzzy match a species name against the GBIF backbone taxonomy.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Species scientific name to match against the GBIF backbone taxonomy. Can be a full or partial scientific name. Example: "Panthera leo" or "Puma concolor". The matching algorithm is fuzzy and will try to find the best match even with misspellings. |
| `strict` | boolean | no | Use strict matching mode. When false (default), allows fuzzy matching with typo tolerance. When true, only exact matches are returned. Recommended: false for most use cases to handle name variations and historical synonyms. (default `false`) |

### gbif_species_vernacular_names

Get vernacular (common) names for a species in multiple languages. Returns preferred names when available.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species key. The unique identifier of the species whose common names you want to retrieve. Example: 5219404 (Panthera leo) returns "African Lion", "Lion", "León", etc. |
| `language` | string | no | ISO 639-1 language code filter to retrieve names in a specific language. 2-letter code. Example: "en" (English), "es" (Spanish), "fr" (French), "de" (German), "pt" (Portuguese), "zh" (Chinese), "ja" (Japanese). Omit to get names in all available languages. (2 chars) |
| `limit` | number | no | Maximum number of vernacular names to return per page. Controls pagination. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Determines the starting point for results. A limit of 20 and offset of 40 will get the third page of 20 results. Default: 0. (default `0`; min 0) |

### gbif_species_synonyms

Get all synonyms and alternative scientific names for a species. Useful for name resolution and historical name tracking.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species key. The unique identifier of the accepted species whose synonyms you want to retrieve. Example: 2435099 (Felis leo) shows that this is a synonym of Panthera leo, along with other historical names. Synonyms include both homotypic (same type specimen) and heterotypic (different type specimen) synonyms. |
| `limit` | number | no | Maximum number of synonyms to return per page. Controls pagination. A species can have many historical synonyms. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Determines the starting point for results. A limit of 20 and offset of 40 will get the third page of 20 results. Default: 0. (default `0`; min 0) |

### gbif_species_children

Get direct taxonomic children of a taxon (e.g., species under a genus, subspecies under a species). Useful for exploring taxonomy hierarchically.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | Parent taxon GBIF key. The unique identifier of the parent taxon whose direct children you want to retrieve. Example: 5219173 (genus Panthera) returns species like P. leo, P. tigris, P. pardus, etc. |
| `limit` | number | no | Maximum number of children to return per page. Controls pagination. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Determines the starting point for results. A limit of 20 and offset of 40 will get the third page of 20 results. Default: 0. (default `0`; min 0) |

### gbif_species_parents

Get the complete taxonomic classification path from kingdom down to the specified taxon. Returns the full hierarchy including all parent taxa. Useful for breadcrumb navigation and understanding taxonomic position.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species/taxon key. The unique identifier of the taxon whose complete classification path you want to retrieve. Example: 5219404 (Panthera leo) returns the full hierarchy: Kingdom Animalia → Phylum Chordata → Class Mammalia → Order Carnivora → Family Felidae → Genus Panthera → Species Panthera leo. Useful for displaying breadcrumb navigation and understanding where a taxon fits in the tree of life. |

### gbif_species_descriptions

Get textual descriptions for a species from various sources. Includes morphological descriptions, habitat information, behavior, and other narrative content.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species key. The unique identifier of the species whose textual descriptions you want to retrieve. Example: 5219404 (Panthera leo) returns descriptions about lion morphology, behavior, habitat preferences, and life history from various authoritative sources. |
| `limit` | number | no | Maximum number of description records to return per page. A species may have multiple descriptions from different sources. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Determines the starting point for results. A limit of 20 and offset of 40 will get the third page of 20 results. Default: 0. (default `0`; min 0) |

### gbif_species_distributions

Get known geographic distribution records for a species. Includes information about occurrence status, establishment means, and locality details.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species key. The unique identifier of the species whose geographic distribution you want to retrieve. Example: 5219404 (Panthera leo) returns distribution records showing where lions occur (e.g., sub-Saharan Africa), their establishment status (native/introduced), and occurrence status (present/absent/extinct). Includes both native and introduced ranges. |
| `limit` | number | no | Maximum number of distribution records to return per page. A species may have distribution records for multiple regions/countries. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Determines the starting point for results. A limit of 20 and offset of 40 will get the third page of 20 results. Default: 0. (default `0`; min 0) |

### gbif_species_media

Get associated multimedia records for a species including images, sounds, and videos. Returns URLs and metadata for media resources from various sources.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species key. The unique identifier of the species whose multimedia you want to retrieve. Example: 5219404 (Panthera leo) returns images, videos, and sound recordings of lions from sources like Wikimedia Commons, Encyclopedia of Life, iNaturalist, and other providers. Each media record includes URLs, license information, and attribution. |
| `limit` | number | no | Maximum number of media records to return per page. A species can have many photos, videos, and sounds from various sources. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Determines the starting point for results. A limit of 20 and offset of 40 will get the third page of 20 results. Default: 0. (default `0`; min 0) |

### gbif_species_metrics

Get quick occurrence statistics for a species without running full searches. Returns total occurrence count, dataset count, country count, and basis of record breakdown. Fast endpoint perfect for species profile pages, dashboards, and quick data availability checks.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species key. The unique identifier of the species whose metrics you want. Example: 5231190 (Panthera leo) returns occurrence count, geographic spread, and data quality metrics. |

### gbif_species_parse_names

Parse and standardize scientific names in batch using GBIF's name parser. Extracts genus, species, authorship, rank, and more from scientific name strings. Essential for data cleaning, quality checking, and standardizing names from spreadsheets or databases. Handles up to 1000 names per request.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `names` | array<string> | yes | Array of scientific names to parse. Each name is a string that may include authorship, year, and infraspecific epithets. Examples: ["Panthera leo (Linnaeus, 1758)", "Puma concolor", "Quercus robur L."]. Maximum: 1000 names per request. Returns parsed components for each name including: genus, specificEpithet, scientificName, authorship, year, rank, and parsing quality indicators. |

### gbif_species_related

Get related species including siblings (same parent taxon), variants, and associated taxa. Useful for taxonomic exploration, "see also" functionality, discovering similar species, and understanding taxonomic relationships. Returns species at the same taxonomic level with shared higher classification.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF species key. The species whose related taxa you want to find. Example: 5231190 (Panthera leo) returns other Panthera species like P. tigris, P. pardus, P. onca. |
| `limit` | number | no | Maximum related species to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset for related species. Default: 0. (default `0`; min 0) |

---

## Occurrence Tools

Occurrence records: search, single records, counts and faceted breakdowns, and asynchronous downloads. All "counts by" tools use faceted search (`/occurrence/search?limit=0&facet=…`), so every search filter applies to them.

### gbif_occurrence_search

Search GBIF occurrence records (species observations and specimens) with comprehensive filtering by taxonomy, geography, time, data quality, and more. Returns paginated results with optional facets for aggregations.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Simple full-text search parameter. The value for this parameter can be a simple word or a phrase. Wildcards are not supported. |
| `scientificName` | string | no | A scientific name from the GBIF backbone or the specified checklist. All included and synonym taxa are included in the search. Under the hood a call to the species match service is done first to retrieve a taxonKey. Only unique scientific names will return results, homonyms return nothing! Consider using the taxonKey parameter instead. Example: "Quercus robur". Parameter may be repeated. |
| `taxonKey` | number | no | A taxon key from the GBIF backbone or the specified checklist. All included (child) and synonym taxa are included in the search, so a search for Aves with taxonKey=212 will match all birds, no matter which species. Example: 2476674. Parameter may be repeated. |
| `kingdomKey` | number | no | Kingdom taxon key from the GBIF backbone. All child taxa are included in the search. Example: 1 (for Animalia). Parameter may be repeated. |
| `phylumKey` | number | no | Phylum taxon key from the GBIF backbone. All child taxa are included in the search. Example: 44 (for Chordata). Parameter may be repeated. |
| `classKey` | number | no | Class taxon key from the GBIF backbone. All child taxa are included in the search. Example: 212 (for Aves - birds). Parameter may be repeated. |
| `orderKey` | number | no | Order taxon key from the GBIF backbone. All child taxa are included in the search. Example: 729 (for Carnivora). Parameter may be repeated. |
| `familyKey` | number | no | Family taxon key from the GBIF backbone. All child taxa are included in the search. Example: 9703 (for Felidae - cats). Parameter may be repeated. |
| `genusKey` | number | no | Genus taxon key from the GBIF backbone. All child taxa are included in the search. Example: 2435194 (for Panthera). Parameter may be repeated. |
| `subgenusKey` | number | no | Subgenus taxon key from the GBIF backbone. All child taxa are included in the search. Parameter may be repeated. |
| `country` | string | no | The 2-letter country code (as per ISO-3166-1) of the country in which the occurrence was recorded. Example: "US" (United States), "BR" (Brazil), "GB" (United Kingdom), "AF" (Afghanistan). Parameter may be repeated. |
| `publishingCountry` | string | no | The 2-letter country code (as per ISO-3166-1) of the country where the publishing organization is based. Example: "DK" (Denmark). Parameter may be repeated. |
| `continent` | enum | no | Continent, as defined in GBIF Continent vocabulary. Values: AFRICA, ANTARCTICA, ASIA, EUROPE, NORTH_AMERICA, OCEANIA, SOUTH_AMERICA. Example: "EUROPE". Parameter may be repeated. (one of `AFRICA`, `ANTARCTICA`, `ASIA`, `EUROPE`, `NORTH_AMERICA`, `OCEANIA`, `SOUTH_AMERICA`) |
| `waterBody` | string | no | The name of the water body in which the Location occurs. Example: "Baltic Sea", "Pacific Ocean", "Lake Victoria". Parameter may be repeated. |
| `stateProvince` | string | no | The name of the next smaller administrative region than country (state, province, canton, department, region, etc.) in which the Location occurs. This term does not have data quality checks. Example: "Leicestershire", "California", "Queensland". Parameter may be repeated. |
| `geometry` | string | no | Searches for occurrences inside a polygon described in Well Known Text (WKT) format. Only POLYGON and MULTIPOLYGON are accepted. Polygons must have anticlockwise ordering of points. Example: "POLYGON ((30.1 10.1, 40 40, 20 40, 10 20, 30.1 10.1))". Parameter may be repeated. |
| `decimalLatitude` | string | no | Latitude in decimal degrees between -90° and 90° based on WGS 84. Supports range queries. Example: "40.5,45" (between 40.5 and 45 degrees). |
| `decimalLongitude` | string | no | Longitude in decimals between -180 and 180 based on WGS 84. Supports range queries. Example: "-120,-95.5" (between -120 and -95.5 degrees). |
| `elevation` | string | no | Elevation (altitude) in metres above sea level. Supports range queries. Example: "1000,1250" (between 1000 and 1250 meters). Parameter may be repeated or a range. |
| `depth` | string | no | Depth in metres relative to altitude. For example 10 metres below a lake surface with given altitude. Supports range queries. Example: "10,20" (between 10 and 20 meters depth). Parameter may be repeated or a range. |
| `hasCoordinate` | boolean | no | Limits searches to occurrence records which contain a value in both latitude and longitude. Set to true to limit to records with coordinate values, false to limit to records without coordinate values. Example: true. |
| `hasGeospatialIssue` | boolean | no | Limits searches to occurrence records which have spatial issues flagged (e.g., coordinates are invalid, out of range, country mismatch). Set to false to exclude records with geospatial issues, true to only include records with issues. Example: false. |
| `repatriated` | boolean | no | Filters for records whose publishing country is different from the country where the record was recorded. Example: true to find specimens collected in one country but held in another. |
| `year` | string | no | The 4 digit year. A year of 98 will be interpreted as AD 98. Supports range queries. Example: 1998 (single year), "2015,2020" (range from 2015 to 2020). Parameter may be repeated or a range. |
| `month` | number | no | The month of the year, starting with 1 for January. Supports range queries. Example: 5 (May), can also use range like "3,6" (March through June). Parameter may be repeated or a range. (min 1; max 12) |
| `decade` | number | no | Decade, calculated as year/10. For example, 199 represents the 1990s (1990-1999). Example: 199 (1990s), 200 (2000s). Parameter may be repeated. |
| `datasetKey` | string | no | The occurrence dataset key (a UUID). Example: "13b70480-bd69-11dd-b15f-b8a03c50a862". Parameter may be repeated. |
| `publishingOrg` | string | no | The publishing organization's GBIF key (a UUID). Example: "e2e717bf-551a-4917-bdc9-4fa0f342c530". Parameter may be repeated. |
| `institutionCode` | string | no | An identifier assigned by the source to identify the institution the record belongs to. Not guaranteed to be unique. Example: "K" (Royal Botanic Gardens, Kew). Parameter may be repeated. |
| `collectionCode` | string | no | An identifier assigned by the source to identify the physical collection or digital dataset uniquely within the context of an institution. Example: "F" (Flora collection). Parameter may be repeated. |
| `catalogNumber` | string | no | An identifier assigned by the source within a physical collection or digital dataset for the record which may not be unique, but should be fairly unique in combination with the institution and collection code. Example: "K001275042". Parameter may be repeated. |
| `recordedBy` | string | no | The person who recorded the occurrence. Example: "Charles Darwin", "MiljoStyrelsen". Parameter may be repeated. |
| `recordNumber` | string | no | An identifier given to the occurrence at the time it was recorded. Often serves as a link between field notes and an occurrence record. Example: "OPP 7101". Parameter may be repeated. |
| `basisOfRecord` | array<enum> | no | Basis of record, as defined in GBIF BasisOfRecord vocabulary. Values: OBSERVATION (general observation), HUMAN_OBSERVATION (visual/aural observation by human), MACHINE_OBSERVATION (automated sensor), MATERIAL_SAMPLE (physical sample), PRESERVED_SPECIMEN (museum specimen), FOSSIL_SPECIMEN (fossilized specimen), LIVING_SPECIMEN (zoo/botanical garden), MATERIAL_CITATION (specimen cited in publication), OCCURRENCE (generic type). Example: "PRESERVED_SPECIMEN". Parameter may be repeated. (items one of `OBSERVATION`, `HUMAN_OBSERVATION`, `MACHINE_OBSERVATION`, `MATERIAL_SAMPLE`, `PRESERVED_SPECIMEN`, `FOSSIL_SPECIMEN`, `LIVING_SPECIMEN`, `MATERIAL_CITATION`, `OCCURRENCE`) |
| `typeStatus` | array<string> | no | Nomenclatural type (type status, typified scientific name, publication) applied to the subject. Filters for type specimens. Example: "HOLOTYPE" (single specimen designated as the type), "PARATYPE" (additional specimens cited in the description), "SYNTYPE", "LECTOTYPE", etc. Parameter may be repeated. |
| `issue` | array<string> | no | A specific interpretation issue as defined in GBIF OccurrenceIssue enumeration. Common values: COUNTRY_COORDINATE_MISMATCH, ZERO_COORDINATE, TAXON_MATCH_FUZZY, RECORDED_DATE_INVALID, COORDINATE_OUT_OF_RANGE, etc. Use to filter by data quality issues or to exclude problematic records. Example: "COUNTRY_COORDINATE_MISMATCH". Parameter may be repeated. |
| `mediaType` | array<enum> | no | The kind of multimedia associated with an occurrence. Values: STILL_IMAGE (photos/illustrations), MOVING_IMAGE (videos), SOUND (audio recordings). Example: "STILL_IMAGE" to find occurrences with photographs. Parameter may be repeated. (items one of `STILL_IMAGE`, `MOVING_IMAGE`, `SOUND`) |
| `facet` | array<string> | no | A facet name used to retrieve the most frequent values for a field. Facets are allowed for all search parameters except geometry and geoDistance. This parameter may be repeated to request multiple facets. Example: ["datasetKey", "basisOfRecord"] to get counts by dataset and basis of record. Note: terms not available for searching are not available for faceting. |
| `facetMincount` | number | no | Used in combination with the facet parameter. Set facetMincount={#} to exclude facets with a count less than {#}. Example: facetMincount=10000 to only show facet values appearing 10,000+ times. (min 1) |
| `facetMultiselect` | boolean | no | Used in combination with the facet parameter. Set facetMultiselect=true to still return counts for values that are not currently filtered. Useful for implementing multi-select faceted search interfaces. |
| `offset` | number | no | Determines the offset for the search results. A limit of 20 and offset of 40 will get the third page of 20 results. This service has a maximum offset of 100,000. Example: offset=300 to start at the 301st result. (default `0`; min 0; max 100000) |
| `limit` | number | no | Controls the number of results in the page. Using too high a value will be overwritten with the maximum threshold, which is 300 for this service. Sensible defaults are used so this may be omitted. Example: limit=100 to get 100 results per page. (default `20`; min 1; max 300) |

### gbif_occurrence_get

Get complete details for a single occurrence record including verbatim fields, interpretation history, media, and data quality issues.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF occurrence key (unique identifier). This is a numeric key that uniquely identifies an occurrence record in GBIF. Example: 1258202889 (a specific specimen record). You can find occurrence keys from search results. |

### gbif_occurrence_count

Fast endpoint for counting occurrences matching filters without retrieving full records. Useful for statistics, dashboards, and filter validation before running full searches.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Full-text search query |
| `scientificName` | string | no | Scientific name to search for |
| `taxonKey` | number | no | GBIF taxon key |
| `kingdomKey` | number | no | Kingdom taxon key |
| `phylumKey` | number | no | Phylum taxon key |
| `classKey` | number | no | Class taxon key |
| `orderKey` | number | no | Order taxon key |
| `familyKey` | number | no | Family taxon key |
| `genusKey` | number | no | Genus taxon key |
| `country` | string | no | ISO country code |
| `continent` | enum | no | Continent filter (one of `AFRICA`, `ANTARCTICA`, `ASIA`, `EUROPE`, `NORTH_AMERICA`, `OCEANIA`, `SOUTH_AMERICA`) |
| `geometry` | string | no | WKT geometry |
| `hasCoordinate` | boolean | no | Filter to records with coordinates |
| `year` | string | no | Year or year range (e.g., "2020,2024") |
| `month` | number | no | Month (1-12) (min 1; max 12) |
| `datasetKey` | string | no | Dataset UUID |
| `publishingOrg` | string | no | Publishing organization UUID |
| `basisOfRecord` | array<enum> | no | Basis of record types (items one of `OBSERVATION`, `HUMAN_OBSERVATION`, `MACHINE_OBSERVATION`, `MATERIAL_SAMPLE`, `PRESERVED_SPECIMEN`, `FOSSIL_SPECIMEN`, `LIVING_SPECIMEN`, `MATERIAL_CITATION`, `OCCURRENCE`) |
| `issue` | array<string> | no | Data quality issues |

### gbif_occurrence_download_request

Request an asynchronous download for large occurrence datasets beyond pagination limits (100,000+ records). Returns a download key for checking status. REQUIRES AUTHENTICATION: Set GBIF_USERNAME and GBIF_PASSWORD environment variables.

**Annotations:** not read-only (`readOnlyHint: false`, `idempotentHint: false`). Calling it creates or changes a job on GBIF.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `creator` | string | yes | GBIF username (creator of the download). This is your GBIF.org username. Example: "john.smith". Required for download attribution and access control. (min length 1) |
| `notificationAddresses` | array<string> | no | Email addresses to notify when download completes. Receives notification with download link when processing is finished. Example: ["user@example.com"]. Optional, but highly recommended for large downloads that may take hours to process. |
| `sendNotification` | boolean | no | Send email notification on completion. Set to true (default) to receive email when download is ready, false to skip notifications. Recommended: true for downloads that take more than a few minutes. (default `true`) |
| `format` | enum | no | Download format. DWCA (Darwin Core Archive) = Full format with metadata and extensions, most comprehensive. SIMPLE_CSV = Simplified CSV format, easier to work with in spreadsheets. SPECIES_LIST = List of unique species only, no occurrence records. Default: SIMPLE_CSV. (one of `DWCA`, `SIMPLE_CSV`, `SPECIES_LIST`; default `"SIMPLE_CSV"`) |
| `predicate` | any | no | Download predicate defining filters (REQUIRED). Complex JSON structure specifying which records to include. Use gbif_occurrence_download_predicate_builder tool to construct this from simple search parameters, or build manually following GBIF download API predicate format. Example: {type: "equals", key: "TAXON_KEY", value: "212"} for all bird records. |

### gbif_occurrence_download_predicate_builder

Helper tool to build a download predicate from simple search parameters. Converts occurrence search filters into the complex predicate format required by the download API.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | GBIF taxon key. A taxon key from the GBIF backbone. All child taxa are included in the download. Example: 212 (for Aves - all birds). |
| `scientificName` | string | no | Scientific name from the GBIF backbone. Example: "Panthera leo". All synonyms and child taxa included. |
| `country` | string | no | 2-letter ISO country code where occurrence was recorded. Example: "US", "BR", "KE". |
| `year` | string | no | Year or year range for occurrence date. Example: "2020" (single year), "2015,2020" (range from 2015 to 2020). |
| `hasCoordinate` | boolean | no | Filter to records with (true) or without (false) geographic coordinates. Example: true for georeferenced records only. |
| `basisOfRecord` | array<enum> | no | Basis of record types to include. Example: ["PRESERVED_SPECIMEN", "FOSSIL_SPECIMEN"] for museum specimens only. Values: OBSERVATION (general), HUMAN_OBSERVATION, MACHINE_OBSERVATION, MATERIAL_SAMPLE, PRESERVED_SPECIMEN, FOSSIL_SPECIMEN, LIVING_SPECIMEN, MATERIAL_CITATION, OCCURRENCE. (items one of `OBSERVATION`, `HUMAN_OBSERVATION`, `MACHINE_OBSERVATION`, `MATERIAL_SAMPLE`, `PRESERVED_SPECIMEN`, `FOSSIL_SPECIMEN`, `LIVING_SPECIMEN`, `MATERIAL_CITATION`, `OCCURRENCE`) |
| `datasetKey` | string | no | Dataset UUID to limit download to specific dataset. Example: "13b70480-bd69-11dd-b15f-b8a03c50a862". |
| `geometry` | string | no | WKT geometry polygon to limit download to geographic area. Polygons must be anticlockwise. Example: "POLYGON ((30.1 10.1, 40 40, 20 40, 10 20, 30.1 10.1))". |

### gbif_occurrence_download_status

Check the status and retrieve metadata for an occurrence download request. Returns status, download link when ready, record count, and file size.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `downloadKey` | string | yes | Download key returned from gbif_occurrence_download_request (min length 1) |

### gbif_occurrence_verbatim

Get the original, unprocessed occurrence record as provided by the publisher, before GBIF interpretation. Includes all original Darwin Core fields with full URIs.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | integer | yes | GBIF occurrence key (unique identifier). This is a numeric key that uniquely identifies an occurrence record. Example: 1258202889. Use this to retrieve the original record exactly as submitted by the data publisher, before GBIF processing and interpretation. |

### gbif_occurrence_counts_by_basis_of_record

Get occurrence counts broken down by basis of record type (observations, specimens, etc.). Returns a breakdown showing how many occurrences of each type match your filters. Essential for understanding dataset composition and data quality. Very fast - use for dashboards and quick statistics.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | Filter to specific taxon. Example: 5231190 (Panthera leo) |
| `country` | string | no | Filter to country. Example: "KE" (Kenya) (2 chars) |
| `year` | string | no | Filter by year or range. Example: "2020,2024" |
| `datasetKey` | string | no | Filter to specific dataset UUID |
| `hasCoordinate` | boolean | no | Filter to georeferenced records |

### gbif_occurrence_counts_by_year

Get occurrence counts broken down by year for temporal trend analysis. Returns year-by-year counts showing how observations have accumulated over time. Perfect for time series visualization, identifying data collection patterns, and understanding temporal coverage. Fast endpoint for dashboards.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | Filter to specific taxon and descendants. Example: 212 (all birds), 5231190 (lions only) |
| `country` | string | no | Filter to specific country. Example: "US", "BR", "KE" (2 chars) |
| `datasetKey` | string | no | Filter to specific dataset UUID |
| `basisOfRecord` | array<string> | no | Filter by record types. Example: ["HUMAN_OBSERVATION", "PRESERVED_SPECIMEN"] |
| `hasCoordinate` | boolean | no | Filter to records with coordinates |

### gbif_occurrence_counts_by_country

Get occurrence counts broken down by country for geographic distribution analysis. Returns counts per country showing global distribution patterns. Essential for understanding species ranges, identifying data gaps by region, and prioritizing conservation efforts. Fast statistics endpoint.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | Filter to specific taxon. Example: 5231190 (Panthera leo) to see lion distribution across countries |
| `year` | string | no | Filter by year or range. Example: "2020,2024" for recent records only |
| `datasetKey` | string | no | Filter to specific dataset to see its geographic coverage |
| `basisOfRecord` | array<string> | no | Filter by record types |
| `hasCoordinate` | boolean | no | Filter to georeferenced records only |

### gbif_occurrence_counts_by_publishing_country

Get occurrence counts broken down by the country of the publishing organization. Shows which countries are contributing data, useful for understanding data provider distribution, identifying data collaboration opportunities, and analyzing global participation in GBIF. Different from occurrence country (where specimen was collected).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | Filter to specific taxon. Example: 212 (birds) to see which countries publish bird data |
| `country` | string | no | Filter by occurrence country (where collected) (2 chars) |
| `year` | string | no | Filter by year or range |
| `datasetKey` | string | no | Filter to specific dataset |
| `hasCoordinate` | boolean | no | Filter to georeferenced records |

### gbif_occurrence_counts_by_dataset

Get occurrence counts broken down by contributing dataset. Identifies which datasets contribute most records for a given query. Essential for data attribution, understanding data sources, finding primary datasets for a taxon/region, and acknowledging data providers. Returns dataset UUIDs with counts.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | Filter to specific taxon. Example: 5231190 (lions) to see which datasets have lion records |
| `country` | string | no | Filter by occurrence country. Example: "KE" to see datasets with Kenyan data (2 chars) |
| `year` | string | no | Filter by year or range. Example: "2020,2024" |
| `basisOfRecord` | array<string> | no | Filter by record types |
| `hasCoordinate` | boolean | no | Filter to georeferenced records |

### gbif_occurrence_counts_by_taxon

Get occurrence counts broken down by species (GBIF backbone speciesKey) for taxonomic composition analysis. Returns counts per species within the filtered taxon, most frequent first (top 100). Useful for understanding biodiversity patterns, identifying dominant species, and analyzing taxonomic coverage within a higher taxon. Fast statistics for ecological analysis.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | Parent taxon to analyze. Example: 2877951 (genus Quercus) returns counts for each oak species |
| `country` | string | no | Filter by country (2 chars) |
| `year` | string | no | Filter by year or range |
| `datasetKey` | string | no | Filter to specific dataset |
| `hasCoordinate` | boolean | no | Filter to georeferenced records |

### gbif_occurrence_counts_by_publishing_org

Get occurrence counts broken down by publishing organization UUID. Identifies which institutions are contributing the most data for a query. Essential for data attribution, understanding institutional contributions, acknowledging data providers, and analyzing organizational participation. Returns organization UUIDs with occurrence counts.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taxonKey` | number | no | Filter to specific taxon. Example: 212 (birds) to see which organizations publish bird data |
| `country` | string | no | Filter by occurrence country (2 chars) |
| `year` | string | no | Filter by year or range |
| `basisOfRecord` | array<string> | no | Filter by record types |
| `hasCoordinate` | boolean | no | Filter to georeferenced records |

---

## Registry Tools

Datasets, publishing organizations, networks, installations, participant nodes and GRSciColl collections and institutions.

### gbif_registry_search_datasets

Search for datasets in the GBIF registry. Find published datasets by type, keyword, publisher, geographic coverage, and taxonomic scope. Essential for discovering data sources and understanding dataset metadata.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Free text search query across dataset title, description, and metadata. Searches in dataset titles, descriptions, keywords, and publishing organization names. Example: "birds", "reef fish", "herbarium specimens". |
| `type` | enum | no | Dataset type filter. OCCURRENCE (observation/specimen records with coordinates and dates), CHECKLIST (species lists without occurrences), SAMPLING_EVENT (structured surveys with effort data), METADATA (dataset descriptions only). Most common: OCCURRENCE. (one of `OCCURRENCE`, `CHECKLIST`, `SAMPLING_EVENT`, `METADATA`) |
| `keyword` | string | no | Filter by dataset keyword. Keywords are controlled vocabulary terms assigned to datasets. Example: "bird", "invasive species", "endangered species". Case-insensitive. |
| `publishingOrg` | string | no | Filter by publishing organization UUID. Returns datasets published by a specific organization. Get organization UUIDs from gbif_registry_search_organizations. Example: "07f617d0-c688-11d8-bf62-b8a03c50a862" (GBIF Secretariat). |
| `publishingCountry` | string | no | Filter by publishing organization country. 2-letter ISO country code. Example: "US" (United States), "GB" (United Kingdom), "BR" (Brazil). Returns datasets published by organizations in that country. (2 chars) |
| `hostingOrg` | string | no | Filter by hosting organization UUID. The organization that hosts the data infrastructure (may differ from publisher). Example: UUID of a data center or aggregator. |
| `decade` | string | no | Filter by decade of temporal coverage. Format: "1980,1990" for data from the 1980s and 1990s. Filters datasets by the decade their occurrence records cover, not publication date. |
| `limit` | number | no | Maximum number of datasets to return per page. Range: 1-1000, default: 20. Use with offset for pagination through large result sets. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Number of results to skip. A limit of 20 and offset of 40 will get the third page. Default: 0. Maximum offset varies by endpoint. (default `0`; min 0) |

### gbif_registry_get_dataset

Get complete metadata for a specific GBIF dataset by its UUID. Returns full dataset details including title, description, contacts, endpoints, geographic/taxonomic coverage, and citation information.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Dataset UUID (universally unique identifier). A unique identifier for the dataset in GBIF registry. Example: "50c9509d-22c7-4a22-a47d-8c48425ef4a7" (GBIF Backbone Taxonomy). Get UUIDs from gbif_registry_search_datasets. (format uuid) |

### gbif_registry_dataset_metrics

Get occurrence statistics and quality metrics for a dataset. Returns counts by basis of record, country, year, and data quality indicators. Useful for understanding dataset composition and coverage.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Dataset UUID. The unique identifier of the dataset whose metrics you want to retrieve. Example: "50c9509d-22c7-4a22-a47d-8c48425ef4a7". Get from gbif_registry_search_datasets or gbif_registry_get_dataset. (format uuid) |

### gbif_registry_dataset_document

Get the EML (Ecological Metadata Language) metadata document for a dataset. Returns structured XML metadata including dataset description, contacts, geographic/taxonomic/temporal coverage, methods, and project information. Essential for proper dataset citation, understanding data collection methods, and accessing complete metadata.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Dataset UUID. The unique identifier of the dataset whose EML document you want. EML is the standard metadata format for ecological datasets. Example: "50c9509d-22c7-4a22-a47d-8c48425ef4a7". Returns XML document. (format uuid) |

### gbif_registry_search_organizations

Search for data-publishing organizations in the GBIF network. Find museums, herbaria, research institutions, and other biodiversity data publishers. Use to discover data providers and understand institutional participation.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Free text search across organization names and descriptions. Searches in organization title, description, and abbreviations. Example: "Natural History Museum", "Smithsonian", "herbarium". |
| `country` | string | no | Filter by organization country. 2-letter ISO country code where the organization is based. Example: "US" (United States), "GB" (United Kingdom), "AU" (Australia). (2 chars) |
| `isEndorsed` | boolean | no | Filter by GBIF endorsement status. Set to true for GBIF-endorsed organizations (officially recognized data publishers), false for non-endorsed. Most data publishers are endorsed. Default: no filter (both endorsed and non-endorsed). |
| `limit` | number | no | Maximum number of organizations to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Number of results to skip before returning results. Default: 0. (default `0`; min 0) |

### gbif_registry_get_organization

Get complete details for a specific data-publishing organization. Returns contacts, addresses, datasets published, endorsement status, and institutional information.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Organization UUID. The unique identifier for the organization in GBIF registry. Example: "07f617d0-c688-11d8-bf62-b8a03c50a862" (GBIF Secretariat). Get from gbif_registry_search_organizations. (format uuid) |

### gbif_registry_organization_datasets

List all datasets published by a specific organization. Shows the complete catalog of datasets contributed by an institution. Useful for understanding an organization's data contributions and portfolio.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `organizationKey` | string | yes | Organization UUID. The unique identifier of the publishing organization. Example: "07f617d0-c688-11d8-bf62-b8a03c50a862". Get from gbif_registry_search_organizations or gbif_registry_get_organization. (format uuid) |
| `type` | enum | no | Filter datasets by type. OCCURRENCE (specimen/observation records), CHECKLIST (species lists), SAMPLING_EVENT (survey data), METADATA (descriptions only). Omit to get all types. (one of `OCCURRENCE`, `CHECKLIST`, `SAMPLING_EVENT`, `METADATA`) |
| `limit` | number | no | Maximum number of datasets to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Number of datasets to skip. Default: 0. (default `0`; min 0) |

### gbif_registry_search_networks

Search for dataset networks in GBIF. Networks are collaborative groups that organize related datasets (e.g., eBird, iNaturalist, Ocean Biodiversity Information System). Use to discover thematic data collections and partnerships.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Free text search query across network names and descriptions. Example: "eBird", "iNaturalist", "ocean", "herbarium network". |
| `identifier` | string | no | Filter by network identifier. A unique identifier for the network. Example: network DOI or other persistent identifier. |
| `limit` | number | no | Maximum number of networks to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Number of results to skip. Default: 0. (default `0`; min 0) |

### gbif_registry_get_network

Get complete details for a specific dataset network. Returns network metadata, constituent datasets, contacts, and description. Use to understand collaborative data initiatives and their scope.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Network UUID. The unique identifier for the network. Example: UUID for eBird network or iNaturalist network. Get from gbif_registry_search_networks. (format uuid) |

### gbif_registry_network_datasets

List all constituent datasets within a specific network. Shows which datasets are part of a collaborative network. Useful for exploring thematic data collections like eBird observations or marine biodiversity networks.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `networkKey` | string | yes | Network UUID. The unique identifier of the network whose constituent datasets you want to list. Get from gbif_registry_search_networks or gbif_registry_get_network. (format uuid) |
| `limit` | number | no | Maximum number of datasets to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Number of datasets to skip. Default: 0. (default `0`; min 0) |

### gbif_registry_search_installations

Search for IPT (Integrated Publishing Toolkit) installations in the GBIF network. IPTs are servers that host and publish biodiversity datasets. Use to find technical infrastructure and data hosting platforms.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Free text search query. Searches installation names and descriptions. Example: "herbarium IPT", "museum server". |
| `type` | string | no | Installation type filter. Common values: IPT_INSTALLATION, DIGIR_INSTALLATION, TAPIR_INSTALLATION, BIOCASE_INSTALLATION. Most common: IPT_INSTALLATION. |
| `limit` | number | no | Maximum installations to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Default: 0. (default `0`; min 0) |

### gbif_registry_get_installation

Get complete details for a specific IPT or data server installation. Returns technical endpoint information, hosting organization, and datasets served by this installation.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Installation UUID. The unique identifier for the installation server. Get from gbif_registry_search_installations. (format uuid) |

### gbif_registry_search_collections

Search the Global Registry of Scientific Collections (GRSciColl) for natural history collections. Find museum collections, herbaria, tissue collections, and other scientific collections worldwide. Use to discover physical specimen holdings and their metadata.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Free text search across collection names, codes, and descriptions. Example: "herbarium", "mammal collection", "Smithsonian", "entomology". |
| `code` | string | no | Collection code filter. The institutional code or acronym for the collection. Example: "USNM" (US National Museum), "K" (Kew Herbarium), "AMNH" (American Museum of Natural History). |
| `institution` | string | no | Filter by parent institution UUID. Returns all collections belonging to a specific institution. Get institution UUIDs from gbif_registry_search_institutions. (format uuid) |
| `country` | string | no | Filter by collection country. 2-letter ISO country code where the collection is physically located. Example: "US", "GB", "FR", "AU". (2 chars) |
| `city` | string | no | Filter by city name where the collection is located. Example: "London", "Washington", "Paris", "Sydney". |
| `limit` | number | no | Maximum collections to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Default: 0. (default `0`; min 0) |

### gbif_registry_get_collection

Get complete details for a specific scientific collection from GRSciColl. Returns collection metadata, institutional affiliation, specimen holdings, contacts, and preservation methods. Essential for understanding physical specimen repositories.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Collection UUID from GRSciColl. The unique identifier for the collection. Example: UUID for USNM Entomology Collection or Kew Herbarium. Get from gbif_registry_search_collections. (format uuid) |

### gbif_registry_search_institutions

Search for scientific institutions in the Global Registry of Scientific Collections (GRSciColl). Find museums, herbaria, universities, and research institutions that house natural history collections worldwide.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Free text search across institution names and descriptions. Searches in institution name, alternative names, and descriptions. Example: "Natural History Museum", "Smithsonian", "Botanischer Garten", "herbarium". |
| `code` | string | no | Institution code filter. The institutional code or acronym. Example: "NMNH" (National Museum of Natural History), "NYBG" (New York Botanical Garden), "AMNH". |
| `country` | string | no | Filter by institution country. 2-letter ISO country code where the institution is located. Example: "US" (United States), "GB" (United Kingdom), "BR" (Brazil), "AU" (Australia). (2 chars) |
| `city` | string | no | Filter by city name where the institution is based. Example: "Washington", "London", "Paris", "Berlin", "Tokyo". |
| `limit` | number | no | Maximum institutions to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Number of results to skip. Default: 0. (default `0`; min 0) |

### gbif_registry_get_institution

Get complete details for a specific scientific institution from GRSciColl. Returns institutional metadata, collections housed, contacts, addresses, and identifiers. Use to understand institution profiles and their collection holdings.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Institution UUID from GRSciColl. The unique identifier for the institution. Example: UUID for Smithsonian Institution or Natural History Museum London. Get from gbif_registry_search_institutions. (format uuid) |

### gbif_registry_list_nodes

List GBIF participant nodes (national/organizational participants). Nodes represent countries or organizations that participate in GBIF governance and data sharing. Essential for understanding GBIF network structure, national participation, and institutional membership.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `country` | string | no | Filter to specific country node. 2-letter ISO code. (2 chars) |
| `limit` | number | no | Maximum nodes to return. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Default: 0. (default `0`; min 0) |

### gbif_registry_get_node

Get complete details for a GBIF participant node. Returns node metadata, contacts, participation type, country information, and endorsement details. Use to understand national GBIF participation, governance structure, and institutional membership.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Node UUID. The unique identifier for the GBIF node. Get from gbif_registry_list_nodes. (format uuid) |

---

## Maps Tools

Build GBIF map tile URLs (vector or raster density maps) for any occurrence filter. The tools return URLs, not image bytes.

### gbif_maps_get_tile_url

Generate a URL for occurrence map tiles with customizable styling and filters. Returns tile URLs in standard web Mercator projection (EPSG:3857) for use in web mapping applications, GIS software, or direct visualization.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `z` | number | yes | Zoom level (0-20). 0 shows the entire world, 20 shows street-level detail. Common values: 0-2 (world), 3-5 (continental), 6-10 (country/regional), 11-15 (city), 16-20 (neighborhood/street). Standard web Mercator zoom levels. (min 0; max 20) |
| `x` | number | yes | Tile column number (X coordinate). Horizontal position in the tile grid at the given zoom level. Valid range: 0 to (2^z - 1). Example: at zoom 0, only x=0 is valid; at zoom 1, x can be 0 or 1. (min 0) |
| `y` | number | yes | Tile row number (Y coordinate). Vertical position in the tile grid at the given zoom level. Valid range: 0 to (2^z - 1). Uses standard TMS (Tile Map Service) row numbering. (min 0) |
| `format` | enum | no | Tile format. PNG (raster image, best for visualization) or MVT (Mapbox Vector Tiles, best for interactive maps with client-side styling). Default: png. (one of `png`, `mvt`; default `"png"`) |
| `style` | string | no | Map style name. Controls color scheme and visualization type. Common values: "classic.poly" (polygons), "purpleHeat.point" (heatmap), "green.poly", "fire.point", "glacier.point". Get available styles from gbif_maps_list_styles. |
| `taxonKey` | number | no | Filter to specific taxon and all its children. GBIF taxon key. Example: 212 (all birds), 5231190 (Panthera leo - African lion). Only occurrences of this taxon will be shown on the map. |
| `country` | string | no | Filter to specific country. 2-letter ISO country code. Example: "US", "BR", "KE". Only occurrences from this country will be mapped. (2 chars) |
| `year` | string | no | Filter by observation year or year range. Format: "2024" (single year) or "2020,2024" (range from 2020-2024). Only occurrences from specified year(s) will appear. |
| `basisOfRecord` | string | no | Filter by observation type. Values: HUMAN_OBSERVATION, MACHINE_OBSERVATION, PRESERVED_SPECIMEN, FOSSIL_SPECIMEN, LIVING_SPECIMEN, MATERIAL_SAMPLE, OCCURRENCE. Controls which types of records appear on map. |
| `datasetKey` | string | no | Filter to specific dataset. Dataset UUID. Only occurrences from this dataset will be mapped. Get dataset UUIDs from gbif_registry_search_datasets. |
| `scale` | number | no | Pixel density scale for retina displays. 1 = standard (256x256px), 2 = retina/2x (512x512px), 4 = ultra-high DPI. Higher values produce sharper images on high-DPI screens but larger file sizes. Default: 1. (min 1; max 4) |
| `srs` | string | no | Spatial Reference System. Default: EPSG:3857 (Web Mercator). Alternative: EPSG:4326 (WGS84 lat/long). Most web mapping libraries expect EPSG:3857. |

### gbif_maps_get_vector_tile_url

Generate URL for occurrence vector tiles in Mapbox Vector Tile (MVT) format. Vector tiles enable client-side styling, interactivity, and dynamic rendering. Ideal for web mapping libraries like Mapbox GL JS, Leaflet with vector tile plugins, or OpenLayers.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `z` | number | yes | Zoom level (0-20). Controls detail level and tile grid size. Standard web Mercator zoom levels. (min 0; max 20) |
| `x` | number | yes | Tile column number. Horizontal position in tile grid. Valid range: 0 to (2^z - 1). (min 0) |
| `y` | number | yes | Tile row number. Vertical position in tile grid. Valid range: 0 to (2^z - 1). (min 0) |
| `style` | string | no | Style name for vector tiles. Common: "classic.poly", "green.poly". Get available styles from gbif_maps_list_styles. |
| `taxonKey` | number | no | Filter to specific taxon. GBIF taxon key. Example: 212 (birds). |
| `country` | string | no | Filter to specific country. 2-letter ISO code. Example: "US". (2 chars) |
| `year` | string | no | Filter by year or year range. Format: "2024" or "2020,2024". |
| `basisOfRecord` | string | no | Filter by record type. Example: HUMAN_OBSERVATION, PRESERVED_SPECIMEN. |
| `datasetKey` | string | no | Filter to specific dataset. Dataset UUID. |

### gbif_maps_get_raster_tile_url

Generate URL for pre-rendered PNG density map tiles. Raster tiles show occurrence density with various color schemes. Fast rendering, ideal for simple map displays. Use for quick visualization without client-side rendering overhead.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `z` | number | yes | Zoom level (0-20). Standard web Mercator zoom. (min 0; max 20) |
| `x` | number | yes | Tile column. Valid: 0 to (2^z - 1). (min 0) |
| `y` | number | yes | Tile row. Valid: 0 to (2^z - 1). (min 0) |
| `style` | string | no | Color scheme for density visualization. Common: "purpleHeat.point" (purple heatmap), "fire.point" (red/yellow), "glacier.point" (blue), "classic.poly" (traditional). Affects how occurrence density is visualized. |
| `taxonKey` | number | no | Filter to specific taxon. Example: 5231190 (lions). |
| `country` | string | no | Filter to country. Example: "KE" (Kenya). (2 chars) |
| `year` | string | no | Filter by year/range. Example: "2020,2024". |
| `scale` | number | no | Pixel density. 1=standard (256x256), 2=retina (512x512). Default: 1. (min 1; max 4) |

### gbif_maps_list_styles

List all available map visualization styles for occurrence tiles. Returns style names, descriptions, and types (density/point/poly). Use to discover visualization options before generating tile URLs with gbif_maps_get_tile_url.

**Parameters:** none.

---

## Literature Tools

Peer-reviewed papers and reports that cite GBIF-mediated data.

### gbif_literature_search

Search scientific literature that cites GBIF data. Find peer-reviewed publications, reports, and papers that used GBIF-mediated data. Useful for understanding data impact, finding research examples, and tracking biodiversity research trends.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | no | Free text search across titles, abstracts, and keywords. Example: "climate change", "species distribution modeling", "conservation", "invasive species". |
| `year` | string | no | Publication year or range. Format: "2024" (single year) or "2020,2024" (range 2020-2024). Filters by the year the article was published. |
| `topics` | array<enum> | no | Filter by research topic. Select one or more topics. Common: BIODIVERSITY_SCIENCE, CONSERVATION, CLIMATE_CHANGE, ECOLOGY, TAXONOMY. (items one of `AGRICULTURE`, `BIODIVERSITY_SCIENCE`, `BIOGEOGRAPHY`, `CITIZEN_SCIENCE`, `CLIMATE_CHANGE`, `CONSERVATION`, `DATA_MANAGEMENT`, `DATA_PAPER`, `ECOLOGY`, `ECOSYSTEM_SERVICES`, `EVOLUTION`, `FRESHWATER`, `HUMAN_HEALTH`, `INVASIVES`, `MARINE`, `PHYLOGENETICS`, `SPECIES_DISTRIBUTIONS`, `TAXONOMY`) |
| `gbifDatasetKey` | string | no | Filter to literature citing a specific dataset. Dataset UUID. Shows papers that used data from a particular dataset. |
| `publishingOrganizationKey` | string | no | Filter to literature citing data from a specific publisher. Organization UUID. |
| `peerReview` | boolean | no | Filter by peer review status. Set true for peer-reviewed articles only, false for non-peer-reviewed. Default: no filter. |
| `openAccess` | boolean | no | Filter by open access status. Set true for open access articles only. Default: no filter. |
| `limit` | number | no | Maximum articles to return per page. Range: 1-1000, default: 20. (default `20`; min 1; max 1000) |
| `offset` | number | no | Pagination offset. Default: 0. (default `0`; min 0) |

### gbif_literature_get

Get complete metadata for a scientific publication by its DOI. Returns title, authors, abstract, journal, citation info, and GBIF usage details. Use to get full details about a specific paper that used GBIF data.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `doi` | string | yes | DOI (Digital Object Identifier) of the publication. Standard format: "10.1234/example". Example: "10.1038/nature12345" or "10.1371/journal.pone.0123456". Get DOIs from gbif_literature_search results. |

---

## Vocabularies Tools

GBIF controlled vocabularies and their concepts.

### gbif_vocabularies_list

List all controlled vocabularies used in GBIF. Vocabularies define valid values for fields like basisOfRecord, establishmentMeans, occurrenceStatus, etc. Essential for understanding valid filter values and data standardization.

**Parameters:** none.

### gbif_vocabularies_get

Get a specific controlled vocabulary with all its concepts and definitions. Returns the complete vocabulary including all valid values, descriptions, and usage notes. Use to understand valid values for specific GBIF fields.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Vocabulary name. The identifier of the vocabulary to retrieve. Common vocabularies: "BasisOfRecord" (observation types), "EstablishmentMeans" (native/introduced status), "DegreeOfEstablishment" (invasion stages), "Pathway" (introduction routes), "OccurrenceStatus" (present/absent). Get names from gbif_vocabularies_list. |

### gbif_vocabularies_get_concept

Get detailed information about a specific concept within a controlled vocabulary. Returns the concept definition, usage notes, related terms, and examples. Use to understand the precise meaning and usage of specific vocabulary terms.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `vocabulary` | string | yes | Vocabulary name. The controlled vocabulary containing the concept. Example: "BasisOfRecord", "EstablishmentMeans", "DegreeOfEstablishment". Get from gbif_vocabularies_list. |
| `concept` | string | yes | Concept name within the vocabulary. The specific term to look up. Examples: For BasisOfRecord: "HUMAN_OBSERVATION", "PRESERVED_SPECIMEN". For EstablishmentMeans: "NATIVE", "INTRODUCED", "NATURALISED". Case-sensitive. |

---

## Validator Tools

Submit Darwin Core archives or tabular files to the GBIF data validator and poll the result. These tools create jobs on GBIF and are not read-only.

### gbif_validator_validate_dwca

Validate a Darwin Core Archive (DwC-A) file against GBIF standards. Checks data structure, required fields, data quality, and format compliance. Returns validation report with issues, warnings, and recommendations. Essential before publishing datasets to GBIF.

**Annotations:** not read-only (`readOnlyHint: false`, `idempotentHint: false`). Calling it creates or changes a job on GBIF.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fileUrl` | string | yes | Public URL of the Darwin Core Archive (.zip file). Must be publicly accessible via HTTP/HTTPS. The archive should contain meta.xml, occurrence.txt or equivalent core file, and optional extension files. Example: "https://example.com/dataset.zip". File will be downloaded and validated asynchronously. (format uri) |

### gbif_validator_get_status

Check the status of an asynchronous Darwin Core Archive validation job. Validation is processed asynchronously, so use this tool to poll for completion and retrieve results. Returns validation status, progress, and results when complete.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `validationKey` | string | yes | Validation job key/ID returned by gbif_validator_validate_dwca. Unique identifier for the validation task. Use to check progress and retrieve results. Example: validation key from previous validation request. |

### gbif_validator_validate_tabular

Validate tabular data files (CSV, TSV) against Darwin Core standards before creating archives. Checks column headers, data types, required fields, and format compliance. Useful for data preparation workflows, pre-publication validation, and quality assurance before creating Darwin Core Archives. Returns validation report with field-level issues.

**Annotations:** not read-only (`readOnlyHint: false`, `idempotentHint: false`). Calling it creates or changes a job on GBIF.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fileUrl` | string | yes | Public URL of the tabular file (.csv or .tsv). Must be publicly accessible. The file should have Darwin Core term headers (scientificName, decimalLatitude, etc.). Example: "https://example.com/occurrences.csv". Will be validated against DwC standards. (format uri) |
| `fileType` | enum | no | File format. CSV (comma-separated) or TSV (tab-separated). Default: CSV. Determines delimiter used for parsing. (one of `CSV`, `TSV`; default `"CSV"`) |

---

## Calling tools over stdio

A 2026-07-28 client sends the protocol envelope in `_meta` on every request:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
  "name":"gbif_species_match",
  "arguments":{"name":"Puma concolor"},
  "_meta":{
    "io.modelcontextprotocol/protocolVersion":"2026-07-28",
    "io.modelcontextprotocol/clientCapabilities":{},
    "io.modelcontextprotocol/clientInfo":{"name":"example","version":"1.0"}
  }
}}
```

2025-era clients use the classic `initialize` handshake first and then call `tools/call` without the envelope; both are served by default (`MCP_LEGACY_CLIENTS=serve`).

## Common workflows

1. **Resolve a name, then query occurrences.** `gbif_species_match` → `usageKey` → `gbif_occurrence_search` / `gbif_occurrence_count` with `taxonKey`.
2. **Profile a taxon.** `gbif_species_get`, `gbif_species_vernacular_names`, `gbif_species_metrics`, then `gbif_occurrence_counts_by_country` and `gbif_occurrence_counts_by_year` for coverage.
3. **Find and cite data.** `gbif_registry_search_datasets` → `gbif_registry_get_dataset` → `gbif_registry_dataset_document` (EML) and `gbif_literature_search` for papers using the dataset.
4. **Large extracts.** `gbif_occurrence_download_predicate_builder` → `gbif_occurrence_download_request` (needs `GBIF_USERNAME`/`GBIF_PASSWORD`) → `gbif_occurrence_download_status`.
5. **Maps.** `gbif_maps_list_styles` → `gbif_maps_get_tile_url` with the same filters as a search.

## Pagination guidelines

- Default `limit` is 20 for most search tools; GBIF caps occurrence search at 300 per page and at offset 100,000. Use downloads beyond that.
- Check `endOfRecords` rather than comparing `offset` with `count`; `count` is approximate for large result sets.
- Use the count and "counts by" tools before paging through large result sets.
