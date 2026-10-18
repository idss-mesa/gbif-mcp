# GBIF API Endpoints - Comprehensive Analysis for MCP Implementation

Base URL: `https://api.gbif.org/v1`

## Table of Contents
1. [Species API](#1-species-api)
2. [Occurrence API](#2-occurrence-api)
3. [Registry API](#3-registry-api)
4. [Maps API](#4-maps-api)
5. [Literature API](#5-literature-api)
6. [Vocabularies API](#6-vocabularies-api)
7. [Validator API](#7-validator-api)
8. [MCP Implementation Considerations](#mcp-implementation-considerations)

## Implementation status and corrections (2026-10-18)

This analysis was written before the server existed. The server now implements 58 tools over
these endpoints (see [TOOLS.md](TOOLS.md)); the adversarial matrix in
`tests/integration/api/all-tools.integration.test.ts` exercises every tool against the live API.
Live testing showed that several endpoints described below behave differently from the
original write-up:

| Section | Endpoint as analysed | What the live API does | What the server uses |
|---|---|---|---|
| 1.4 | `GET /parser/name?name=` | Works, but one name per call | `POST /parser/name` with a JSON array of names (`gbif_species_parse_names`) |
| 2.9 | `GET /occurrence/counts/{basisOfRecord,year,datasets,countries,publishingCountries}` | Retired, or returned without applying filters | `GET /occurrence/search?limit=0&facet=X&facetLimit=N`; every search filter applies (all `gbif_occurrence_counts_by_*` tools) |
| 3.3 | `GET /dataset/{key}/document` | Answers 406 unless the client accepts XML | Same path with `Accept: application/xml`, returned as text (`gbif_registry_dataset_document`) |
| 3.7 | `GET /organization/search` | 404 | `GET /organization` with `q`, `country`, `isEndorsed`, paging (`gbif_registry_search_organizations`) |
| 3.11 | `GET /installation/search` | 404 | `GET /installation` (`gbif_registry_search_installations`) |
| 3.13 | `GET /network/search` | 404 | `GET /network` (`gbif_registry_search_networks`) |
| 5.2 | `GET /literature/{id}` | Internal ids are not exposed to callers | `GET /literature/search?doi=…&limit=1` with DOI prefixes normalised (`gbif_literature_get`) |

Not implemented (by design): 2.4 occurrence fragment, 2.7 user downloads list, 2.10/2.11 schema
and inventory, 3.5/3.6 dataset constituents and networks, 3.10 organization installations,
3.15 network constituents, 3.20 staff, 4.3 adhoc static maps, 5.3 literature export, 6.4 is
covered through the generic vocabulary tools, 7.2 EML validation and 7.4 quality reports.
Every other endpoint in sections 1 to 7 has a tool.

---

## 1. Species API

The Species API provides access to GBIF's taxonomic backbone and related nomenclatural information.

### 1.1 Species Search

**Endpoint:** `GET /species/search`

**Purpose:** Full-text search across all name usages in the GBIF backbone taxonomy.

**Parameters:**
- `q` (string, optional): Simple search parameter for full-text search
- `rank` (enum, optional): Taxonomic rank (KINGDOM, PHYLUM, CLASS, ORDER, FAMILY, GENUS, SPECIES, etc.)
- `highertaxonKey` (integer, optional): Filter by higher taxon
- `status` (enum, optional): Nomenclatural status (ACCEPTED, SYNONYM, DOUBTFUL, etc.)
- `isExtinct` (boolean, optional): Filter extinct taxa
- `habitat` (enum, optional): MARINE, FRESHWATER, TERRESTRIAL
- `nameType` (enum, optional): SCIENTIFIC, VIRUS, HYBRID, INFORMAL, CULTIVAR, etc.
- `datasetKey` (UUID, optional): Filter by checklist dataset
- `nomenclaturalStatus` (array, optional): Nomenclatural status values
- `threatStatus` (enum, optional): IUCN threat status
- `limit` (integer, optional): Number of results (default: 20, max: 300)
- `offset` (integer, optional): Record offset for pagination (default: 0)

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 1234,
  "results": [
    {
      "key": 2435099,
      "nubKey": 2435099,
      "nameKey": 2435098,
      "taxonID": "gbif:2435099",
      "scientificName": "Puma concolor (Linnaeus, 1771)",
      "canonicalName": "Puma concolor",
      "authorship": "(Linnaeus, 1771)",
      "nameType": "SCIENTIFIC",
      "rank": "SPECIES",
      "origin": "SOURCE",
      "taxonomicStatus": "ACCEPTED",
      "nomenclaturalStatus": [],
      "kingdom": "Animalia",
      "phylum": "Chordata",
      "order": "Carnivora",
      "family": "Felidae",
      "genus": "Puma",
      "species": "Puma concolor",
      "kingdomKey": 1,
      "phylumKey": 44,
      "classKey": 359,
      "orderKey": 732,
      "familyKey": 9703,
      "genusKey": 2435098,
      "speciesKey": 2435099,
      "numDescendants": 6,
      "publishedIn": "Syst. Nat. ed. 12, 1: 62.",
      "extinct": false,
      "habitats": ["TERRESTRIAL"]
    }
  ]
}
```

**Rate Limiting:** No explicit rate limits, but use respectful intervals (1-2 requests/second recommended)

**Use Cases:**
- Taxonomic name search and validation
- Building taxonomic dropdowns
- Species discovery

---

### 1.2 Species Lookup (by Key)

**Endpoint:** `GET /species/{key}`

**Purpose:** Retrieve complete details for a single taxon by its GBIF key.

**Parameters:**
- `key` (integer, required, path): The GBIF taxon key

**Response Structure:**
```json
{
  "key": 2435099,
  "nubKey": 2435099,
  "nameKey": 2435098,
  "scientificName": "Puma concolor (Linnaeus, 1771)",
  "canonicalName": "Puma concolor",
  "authorship": "(Linnaeus, 1771)",
  "rank": "SPECIES",
  "origin": "SOURCE",
  "taxonomicStatus": "ACCEPTED",
  "kingdom": "Animalia",
  "phylum": "Chordata",
  "class": "Mammalia",
  "order": "Carnivora",
  "family": "Felidae",
  "genus": "Puma",
  "species": "Puma concolor",
  "kingdomKey": 1,
  "phylumKey": 44,
  "classKey": 359,
  "orderKey": 732,
  "familyKey": 9703,
  "genusKey": 2435098,
  "speciesKey": 2435099,
  "extinct": false,
  "habitats": ["TERRESTRIAL"],
  "nomenclaturalStatus": [],
  "threatStatuses": ["LEAST_CONCERN"],
  "descriptions": [],
  "vernacularNames": [],
  "references": []
}
```

**Use Cases:**
- Retrieving complete taxon information
- Resolving taxon keys to full records
- Building species profile pages

---

### 1.3 Name Matching

**Endpoint:** `GET /species/match`

**Purpose:** Fuzzy matching of scientific names against GBIF backbone taxonomy. Critical for data integration.

**Parameters:**
- `name` (string, optional): Scientific name to match
- `rank` (enum, optional): Expected rank
- `kingdom` (string, optional): Kingdom context for matching
- `phylum` (string, optional): Phylum context
- `class` (string, optional): Class context
- `order` (string, optional): Order context
- `family` (string, optional): Family context
- `genus` (string, optional): Genus context
- `strict` (boolean, optional): Strict matching mode (default: false)
- `verbose` (boolean, optional): Extended response with alternatives (default: false)

**Response Structure:**
```json
{
  "usageKey": 2435099,
  "scientificName": "Puma concolor (Linnaeus, 1771)",
  "canonicalName": "Puma concolor",
  "rank": "SPECIES",
  "status": "ACCEPTED",
  "confidence": 97,
  "matchType": "EXACT",
  "kingdom": "Animalia",
  "phylum": "Chordata",
  "order": "Carnivora",
  "family": "Felidae",
  "genus": "Puma",
  "species": "Puma concolor",
  "kingdomKey": 1,
  "phylumKey": 44,
  "classKey": 359,
  "orderKey": 732,
  "familyKey": 9703,
  "genusKey": 2435098,
  "speciesKey": 2435099,
  "synonym": false,
  "class": "Mammalia"
}
```

**Match Types:**
- `EXACT`: Perfect match
- `FUZZY`: Close match with spelling variations
- `HIGHERRANK`: Matched to higher taxonomic rank
- `NONE`: No match found

**Use Cases:**
- Name standardization and validation
- Data cleaning pipelines
- Taxonomic reconciliation

---

### 1.4 Name Parser

> **Correction (2026-10-18):** the server uses the bulk `POST /parser/name` endpoint (JSON array body) for `gbif_species_parse_names`; the GET form works but parses one name per call.

**Endpoint:** `GET /parser/name`

**Purpose:** Parse scientific names into components (genus, species, authorship, etc.) without matching.

**Parameters:**
- `name` (string, required): Scientific name to parse

**Response Structure:**
```json
{
  "type": "SCIENTIFIC",
  "scientificName": "Puma concolor (Linnaeus, 1771)",
  "canonicalName": "Puma concolor",
  "canonicalNameWithMarker": "Puma concolor",
  "canonicalNameComplete": "Puma concolor",
  "authorship": "(Linnaeus, 1771)",
  "bracketAuthorship": "Linnaeus, 1771",
  "year": "1771",
  "rankMarker": null,
  "parsed": true,
  "parsedPartially": false,
  "genus": "Puma",
  "specificEpithet": "concolor"
}
```

**Bulk Endpoint:** `POST /parser/name`
- Body: Array of scientific names (max 1000)
- Returns: Array of parsed results

**Use Cases:**
- Name component extraction
- Authorship parsing
- Name normalization

---

### 1.5 Species Suggest

**Endpoint:** `GET /species/suggest`

**Purpose:** Fast auto-complete style suggestions for scientific names.

**Parameters:**
- `q` (string, required): Search query (minimum 3 characters recommended)
- `datasetKey` (UUID, optional): Limit to specific checklist
- `rank` (enum, optional): Filter by rank
- `limit` (integer, optional): Max results (default: 10, max: 100)

**Response Structure:**
```json
[
  {
    "key": 2435099,
    "scientificName": "Puma concolor (Linnaeus, 1771)",
    "canonicalName": "Puma concolor",
    "rank": "SPECIES"
  }
]
```

**Use Cases:**
- Autocomplete interfaces
- Quick name lookup
- Search suggestions

---

### 1.6 Vernacular Names

**Endpoint:** `GET /species/{key}/vernacularNames`

**Purpose:** Retrieve common names in multiple languages.

**Parameters:**
- `key` (integer, required, path): GBIF taxon key
- `language` (string, optional): ISO 639-1 language code (e.g., "en", "es", "fr")

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": true,
  "results": [
    {
      "vernacularName": "Mountain Lion",
      "language": "en",
      "source": "Catalogue of Life",
      "sourceTaxonKey": 123456,
      "preferred": true
    },
    {
      "vernacularName": "Cougar",
      "language": "en",
      "source": "Integrated Taxonomic Information System (ITIS)"
    },
    {
      "vernacularName": "Puma",
      "language": "es",
      "preferred": true
    }
  ]
}
```

**Use Cases:**
- Displaying common names
- Multi-language applications
- Species identification aids

---

### 1.7 Synonyms

**Endpoint:** `GET /species/{key}/synonyms`

**Purpose:** List all synonyms for a taxon.

**Parameters:**
- `key` (integer, required, path): GBIF taxon key
- `limit` (integer, optional): Default 20, max 300
- `offset` (integer, optional): Pagination offset

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": true,
  "results": [
    {
      "key": 2435100,
      "scientificName": "Felis concolor Linnaeus, 1771",
      "canonicalName": "Felis concolor",
      "rank": "SPECIES",
      "taxonomicStatus": "SYNONYM",
      "acceptedKey": 2435099,
      "accepted": "Puma concolor (Linnaeus, 1771)",
      "kingdom": "Animalia",
      "phylum": "Chordata",
      "class": "Mammalia",
      "order": "Carnivora",
      "family": "Felidae"
    }
  ]
}
```

**Use Cases:**
- Name resolution
- Historical name tracking
- Literature reconciliation

---

### 1.8 Species Children

**Endpoint:** `GET /species/{key}/children`

**Purpose:** List direct taxonomic children (e.g., species under a genus).

**Parameters:**
- `key` (integer, required, path): Parent taxon key
- `limit` (integer, optional): Default 20, max 300
- `offset` (integer, optional): Pagination

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "results": [
    {
      "key": 2435100,
      "scientificName": "Puma concolor anthonyi Nelson & Goldman, 1931",
      "canonicalName": "Puma concolor anthonyi",
      "rank": "SUBSPECIES",
      "taxonomicStatus": "ACCEPTED",
      "parentKey": 2435099,
      "parent": "Puma concolor"
    }
  ]
}
```

**Use Cases:**
- Building taxonomic trees
- Browsing taxonomy
- Species enumeration

---

### 1.9 Species Parents

**Endpoint:** `GET /species/{key}/parents`

**Purpose:** Get complete taxonomic classification path from kingdom to taxon.

**Parameters:**
- `key` (integer, required, path): GBIF taxon key

**Response Structure:**
```json
[
  {
    "key": 1,
    "scientificName": "Animalia",
    "canonicalName": "Animalia",
    "rank": "KINGDOM"
  },
  {
    "key": 44,
    "scientificName": "Chordata",
    "canonicalName": "Chordata",
    "rank": "PHYLUM"
  },
  {
    "key": 359,
    "scientificName": "Mammalia",
    "canonicalName": "Mammalia",
    "rank": "CLASS"
  },
  {
    "key": 732,
    "scientificName": "Carnivora",
    "canonicalName": "Carnivora",
    "rank": "ORDER"
  },
  {
    "key": 9703,
    "scientificName": "Felidae",
    "canonicalName": "Felidae",
    "rank": "FAMILY"
  },
  {
    "key": 2435098,
    "scientificName": "Puma",
    "canonicalName": "Puma",
    "rank": "GENUS"
  }
]
```

**Use Cases:**
- Building breadcrumb navigation
- Classification display
- Hierarchical filtering

---

### 1.10 Species Related

**Endpoint:** `GET /species/{key}/related`

**Purpose:** Find related taxa (similar names, potential synonyms).

**Parameters:**
- `key` (integer, required, path): GBIF taxon key
- `datasetKey` (UUID, optional): Limit to dataset
- `limit` (integer, optional): Default 20, max 100

**Use Cases:**
- Discovering potential synonyms
- Name variant exploration
- Data quality checks

---

### 1.11 Descriptions

**Endpoint:** `GET /species/{key}/descriptions`

**Purpose:** Retrieve species descriptions and textual information.

**Parameters:**
- `key` (integer, required, path): GBIF taxon key
- `limit` (integer, optional): Default 20, max 300

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": true,
  "results": [
    {
      "type": "general",
      "language": "en",
      "description": "The cougar (Puma concolor) is a large cat...",
      "source": "Wikipedia"
    }
  ]
}
```

---

### 1.12 Distributions

**Endpoint:** `GET /species/{key}/distributions`

**Purpose:** Get known distribution information for a taxon.

**Parameters:**
- `key` (integer, required, path): GBIF taxon key
- `limit` (integer, optional): Default 20, max 300

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": true,
  "results": [
    {
      "locationId": "US",
      "locality": "United States",
      "country": "US",
      "establishmentMeans": "NATIVE",
      "threatStatus": "LEAST_CONCERN",
      "source": "IUCN Red List"
    }
  ]
}
```

---

### 1.13 Media

**Endpoint:** `GET /species/{key}/media`

**Purpose:** Retrieve associated images and multimedia.

**Parameters:**
- `key` (integer, required, path): GBIF taxon key
- `limit` (integer, optional): Default 20, max 300

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": true,
  "results": [
    {
      "type": "StillImage",
      "format": "image/jpeg",
      "identifier": "http://example.org/image.jpg",
      "creator": "John Doe",
      "license": "CC-BY-4.0",
      "title": "Adult specimen"
    }
  ]
}
```

---

### 1.14 Species Metrics

**Endpoint:** `GET /species/{key}/metrics`

**Purpose:** Get occurrence counts and other metrics for a taxon.

**Response Structure:**
```json
{
  "key": 2435099,
  "numOccurrences": 125423,
  "numGeoreferencedOccurrences": 98234,
  "numImagesOccurrences": 15673,
  "numWithCoordinates": 98234,
  "numByKingdom": {
    "Animalia": 125423
  }
}
```

---

## 2. Occurrence API

The Occurrence API provides access to occurrence records - the core biodiversity observation data in GBIF.

### 2.1 Occurrence Search

**Endpoint:** `GET /occurrence/search`

**Purpose:** Primary endpoint for searching and filtering occurrence records.

**Parameters (extensive):**

**Taxonomic Filters:**
- `taxonKey` (integer, optional): GBIF taxon key (includes children)
- `scientificName` (string, optional): Scientific name
- `kingdomKey`, `phylumKey`, `classKey`, `orderKey`, `familyKey`, `genusKey`, `speciesKey` (integer, optional): Higher taxonomy filters

**Geographic Filters:**
- `country` (string, optional): ISO 3166-1 alpha-2 country code
- `continent` (enum, optional): AFRICA, ANTARCTICA, ASIA, EUROPE, NORTH_AMERICA, OCEANIA, SOUTH_AMERICA
- `geometry` (WKT, optional): Well-Known Text polygon (max 10 points)
- `decimalLatitude` (number, optional): Latitude
- `decimalLongitude` (number, optional): Longitude
- `coordinateUncertaintyInMeters` (string, optional): Range filter (e.g., "0,1000")
- `hasGeospatialIssue` (boolean, optional): Filter records with geospatial issues
- `hasCoordinate` (boolean, optional): Only georeferenced records

**Temporal Filters:**
- `year` (string, optional): Year or range (e.g., "2020", "2015,2020")
- `month` (integer, optional): Month (1-12)
- `eventDate` (string, optional): ISO 8601 date or range
- `lastInterpreted` (string, optional): Last processing date

**Data Quality Filters:**
- `issue` (enum, optional): Data quality issue codes (ZERO_COORDINATE, COUNTRY_COORDINATE_MISMATCH, etc.)
- `basisOfRecord` (enum, optional): HUMAN_OBSERVATION, MACHINE_OBSERVATION, PRESERVED_SPECIMEN, FOSSIL_SPECIMEN, LIVING_SPECIMEN, MATERIAL_SAMPLE, OBSERVATION
- `establishmentMeans` (enum, optional): NATIVE, INTRODUCED, NATURALISED, INVASIVE, MANAGED, VAGRANT

**Dataset Filters:**
- `datasetKey` (UUID, optional): Dataset UUID
- `publishingCountry` (string, optional): Publisher's country code
- `publishingOrg` (UUID, optional): Publishing organization UUID
- `institutionCode` (string, optional): Institution code
- `collectionCode` (string, optional): Collection code
- `catalogNumber` (string, optional): Catalog number
- `recordedBy` (string, optional): Collector name
- `recordNumber` (string, optional): Collector's record number

**Media Filters:**
- `mediaType` (enum, optional): StillImage, MovingImage, Sound

**Pagination:**
- `limit` (integer, optional): Results per page (default: 20, max: 300)
- `offset` (integer, optional): Record offset (default: 0, max: 100,000)

**Response Control:**
- `facet` (string, optional, repeatable): Facet fields for aggregation
- `facetMincount` (integer, optional): Minimum facet count
- `facetMultiselect` (boolean, optional): Enable multi-facet selection

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 1523678,
  "results": [
    {
      "key": 1234567890,
      "datasetKey": "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
      "publishingOrgKey": "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
      "publishingCountry": "US",
      "protocol": "DWC_ARCHIVE",
      "lastCrawled": "2024-01-15T10:23:45.000+0000",
      "lastParsed": "2024-01-15T10:30:12.000+0000",
      "crawlId": 123,
      "basisOfRecord": "HUMAN_OBSERVATION",
      "occurrenceStatus": "PRESENT",
      "taxonKey": 2435099,
      "kingdomKey": 1,
      "phylumKey": 44,
      "classKey": 359,
      "orderKey": 732,
      "familyKey": 9703,
      "genusKey": 2435098,
      "speciesKey": 2435099,
      "acceptedTaxonKey": 2435099,
      "scientificName": "Puma concolor (Linnaeus, 1771)",
      "acceptedScientificName": "Puma concolor (Linnaeus, 1771)",
      "kingdom": "Animalia",
      "phylum": "Chordata",
      "order": "Carnivora",
      "family": "Felidae",
      "genus": "Puma",
      "species": "Puma concolor",
      "genericName": "Puma",
      "specificEpithet": "concolor",
      "taxonRank": "SPECIES",
      "taxonomicStatus": "ACCEPTED",
      "decimalLatitude": 40.7128,
      "decimalLongitude": -74.0060,
      "coordinateUncertaintyInMeters": 100.0,
      "coordinatePrecision": 0.0001,
      "elevation": 50.0,
      "elevationAccuracy": 10.0,
      "depth": null,
      "depthAccuracy": null,
      "continent": "NORTH_AMERICA",
      "country": "US",
      "countryCode": "US",
      "stateProvince": "New York",
      "county": "New York County",
      "municipality": "New York",
      "locality": "Central Park",
      "year": 2024,
      "month": 1,
      "day": 15,
      "eventDate": "2024-01-15T00:00:00",
      "startDayOfYear": 15,
      "endDayOfYear": 15,
      "modified": "2024-01-15T10:00:00",
      "lastInterpreted": "2024-01-15T10:30:12.000+0000",
      "license": "CC_BY_4_0",
      "identifiers": [],
      "facts": [],
      "relations": [],
      "geodeticDatum": "WGS84",
      "class": "Mammalia",
      "occurrenceID": "urn:catalog:INSTITUTION:COLLECTION:123456",
      "institutionCode": "INSTITUTION",
      "collectionCode": "COLLECTION",
      "catalogNumber": "123456",
      "recordedBy": "John Doe",
      "identifiedBy": "Jane Smith",
      "dateIdentified": "2024-01-20",
      "eventRemarks": "Observed at dawn",
      "occurrenceRemarks": "Single individual",
      "recordNumber": "2024-001",
      "establishmentMeans": "NATIVE",
      "mediaType": ["StillImage"],
      "media": [
        {
          "type": "StillImage",
          "format": "image/jpeg",
          "identifier": "http://example.org/image.jpg",
          "created": "2024-01-15",
          "creator": "John Doe",
          "license": "CC-BY-4.0"
        }
      ],
      "issues": [],
      "gadm": {
        "level0": {
          "gid": "USA",
          "name": "United States"
        },
        "level1": {
          "gid": "USA.36_1",
          "name": "New York"
        }
      }
    }
  ],
  "facets": [
    {
      "field": "basisOfRecord",
      "counts": [
        {"name": "HUMAN_OBSERVATION", "count": 850000},
        {"name": "PRESERVED_SPECIMEN", "count": 500000},
        {"name": "MACHINE_OBSERVATION", "count": 173678}
      ]
    }
  ]
}
```

**Rate Limiting:** No explicit limits, but very large queries may timeout. Use pagination for large datasets.

**Important Notes:**
- Maximum offset is 100,000 - for larger datasets use the download API
- Faceting can be used on most filter parameters
- Geometry parameter uses WKT format with max 10 vertices for performance
- Coordinate uncertainty is in meters

**Use Cases:**
- Geographic occurrence mapping
- Temporal trend analysis
- Data quality assessment
- Species distribution modeling
- Biodiversity assessments

---

### 2.2 Occurrence Detail

**Endpoint:** `GET /occurrence/{key}`

**Purpose:** Retrieve complete details for a single occurrence record.

**Parameters:**
- `key` (integer, required, path): GBIF occurrence key

**Response Structure:**
Same as individual record in search results, but includes additional fields:
- Complete verbatim fields (original as provided)
- Full interpretation history
- All identifiers and relationships
- Complete media records
- All data quality issues with explanations

**Use Cases:**
- Detailed record inspection
- Data quality review
- Citation and reference

---

### 2.3 Occurrence Verbatim

**Endpoint:** `GET /occurrence/{key}/verbatim`

**Purpose:** Get the original, unprocessed occurrence record as provided by the publisher.

**Parameters:**
- `key` (integer, required, path): GBIF occurrence key

**Response Structure:**
```json
{
  "key": 1234567890,
  "datasetKey": "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
  "publishingOrgKey": "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
  "protocol": "DWC_ARCHIVE",
  "lastCrawled": "2024-01-15T10:23:45.000+0000",
  "lastParsed": "2024-01-15T10:30:12.000+0000",
  "crawlId": 123,
  "extensions": {},
  "fields": {
    "http://rs.tdwg.org/dwc/terms/scientificName": "Puma concolor",
    "http://rs.tdwg.org/dwc/terms/decimalLatitude": "40.7128",
    "http://rs.tdwg.org/dwc/terms/decimalLongitude": "-74.0060",
    "http://rs.tdwg.org/dwc/terms/eventDate": "2024-01-15",
    "http://rs.tdwg.org/dwc/terms/basisOfRecord": "HumanObservation",
    "http://rs.tdwg.org/dwc/terms/occurrenceID": "urn:catalog:INSTITUTION:COLLECTION:123456"
  }
}
```

**Use Cases:**
- Debugging data issues
- Understanding original data structure
- Data quality analysis

---

### 2.4 Occurrence Fragment

**Endpoint:** `GET /occurrence/{key}/fragment`

**Purpose:** Get the raw XML or JSON fragment from the original archive.

**Parameters:**
- `key` (integer, required, path): GBIF occurrence key

**Use Cases:**
- Low-level debugging
- Archive inspection
- Original format analysis

---

### 2.5 Occurrence Download (Asynchronous)

**Endpoint:** `POST /occurrence/download/request`

**Purpose:** Request a full dataset download (for large result sets beyond pagination limits).

**Authentication:** Required (HTTP Basic Auth with GBIF username/password)

**Request Body:**
```json
{
  "creator": "username",
  "notificationAddresses": ["email@example.com"],
  "sendNotification": true,
  "format": "DWCA",
  "predicate": {
    "type": "and",
    "predicates": [
      {
        "type": "equals",
        "key": "TAXON_KEY",
        "value": "2435099"
      },
      {
        "type": "equals",
        "key": "COUNTRY",
        "value": "US"
      },
      {
        "type": "greaterThanOrEquals",
        "key": "YEAR",
        "value": "2020"
      }
    ]
  }
}
```

**Download Formats:**
- `DWCA`: Darwin Core Archive (default)
- `SIMPLE_CSV`: Simple CSV with common fields
- `SPECIES_LIST`: List of species only
- `SIMPLE_PARQUET`: Parquet format for big data

**Predicate Types:**
- `equals`, `notEquals`
- `lessThan`, `lessThanOrEquals`
- `greaterThan`, `greaterThanOrEquals`
- `in`, `within` (for geography)
- `like` (for text matching)
- `isNotNull`, `isNull`
- `and`, `or`, `not` (for combining predicates)

**Response:**
```json
"0001234-241115141502345"
```
(Download key - use to check status)

---

### 2.6 Download Status Check

**Endpoint:** `GET /occurrence/download/{downloadKey}`

**Parameters:**
- `downloadKey` (string, required, path): Download key from request

**Response Structure:**
```json
{
  "key": "0001234-241115141502345",
  "doi": "10.15468/dl.abc123",
  "license": "CC_BY_4_0",
  "request": { /* original request */ },
  "created": "2024-01-15T10:00:00.000+0000",
  "modified": "2024-01-15T10:15:00.000+0000",
  "status": "SUCCEEDED",
  "downloadLink": "https://api.gbif.org/v1/occurrence/download/request/0001234-241115141502345.zip",
  "size": 1234567890,
  "totalRecords": 125423,
  "numberDatasets": 15
}
```

**Status Values:**
- `PREPARING`: Download being prepared
- `RUNNING`: Download in progress
- `SUCCEEDED`: Download ready
- `FAILED`: Download failed
- `CANCELLED`: Download cancelled

**Use Cases:**
- Large dataset retrieval
- Reproducible downloads with DOIs
- Offline analysis preparation

---

### 2.7 User Downloads List

**Endpoint:** `GET /occurrence/download/user/{username}`

**Purpose:** List all downloads for a user.

**Authentication:** Required

**Parameters:**
- `username` (string, required, path): GBIF username
- `limit` (integer, optional): Default 20, max 300
- `offset` (integer, optional): Pagination

---

### 2.8 Occurrence Count

**Endpoint:** `GET /occurrence/count`

**Purpose:** Get count of occurrences matching filters (faster than search for counts only).

**Parameters:** Same as `/occurrence/search`

**Response:**
```json
1523678
```
(Simple integer count)

**Use Cases:**
- Quick statistics
- Dashboard metrics
- Filter validation

---

### 2.9 Occurrence Metrics (Catalog)

> **Correction (2026-10-18):** these `/occurrence/counts/*` endpoints are retired or ignore filters on the live API. The server derives all breakdowns from faceted search instead: `GET /occurrence/search?limit=0&facet=<dimension>&facetLimit=<n>`, which honours every search filter.

**Endpoint:** `GET /occurrence/counts/catalog`

**Purpose:** Get comprehensive occurrence metrics broken down by various dimensions.

**Sub-endpoints:**
- `GET /occurrence/counts/basisOfRecord`: Counts by basis of record
- `GET /occurrence/counts/year`: Counts by year (with optional year range)
- `GET /occurrence/counts/datasets`: Counts by dataset
- `GET /occurrence/counts/countries`: Counts by country
- `GET /occurrence/counts/publishingCountries`: Counts by publishing country

**Parameters:** Supports filtering like search endpoint

**Response Example (by year):**
```json
[
  {"year": 2024, "count": 156789},
  {"year": 2023, "count": 234567},
  {"year": 2022, "count": 345678}
]
```

---

### 2.10 Occurrence Schema

**Endpoint:** `GET /occurrence/term`

**Purpose:** Get Darwin Core term definitions and usage.

**Response:** List of all supported Darwin Core terms with definitions.

---

### 2.11 Occurrence Inventory

**Endpoint:** `GET /occurrence/counts/taxonKeys`

**Purpose:** Get list of taxon keys present in filtered occurrences.

**Parameters:** Supports standard filters

**Use Cases:**
- Species lists
- Taxonomic coverage
- Inventory generation

---

## 3. Registry API

The Registry API provides access to datasets, organizations, installations, and networks in GBIF.

### 3.1 Dataset Search

**Endpoint:** `GET /dataset/search`

**Purpose:** Search and filter published datasets.

**Parameters:**
- `q` (string, optional): Full-text search query
- `type` (enum, optional): OCCURRENCE, CHECKLIST, SAMPLING_EVENT, METADATA
- `subtype` (enum, optional): TAXONOMIC_AUTHORITY, NOMENCLATOR_AUTHORITY, INVENTORY_THEMATIC, etc.
- `keyword` (string, optional): Keyword filter
- `publishingCountry` (string, optional): ISO country code
- `publishingOrg` (UUID, optional): Publishing organization UUID
- `hostingOrg` (UUID, optional): Technical hosting organization UUID
- `decade` (integer, optional): Temporal coverage decade
- `projectId` (string, optional): Project identifier
- `hostingCountry` (string, optional): Hosting country
- `networkKey` (UUID, optional): Network UUID
- `license` (enum, optional): CC0_1_0, CC_BY_4_0, CC_BY_NC_4_0
- `limit` (integer, optional): Default 20, max 1000
- `offset` (integer, optional): Pagination

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 85234,
  "results": [
    {
      "key": "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
      "type": "OCCURRENCE",
      "title": "eBird Observation Dataset",
      "description": "Bird observations from eBird...",
      "doi": "10.15468/aomfnb",
      "created": "2010-01-15T00:00:00.000+0000",
      "modified": "2024-01-15T10:00:00.000+0000",
      "publishingOrganizationKey": "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
      "publishingOrganizationTitle": "Cornell Lab of Ornithology",
      "hostingOrganizationKey": "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
      "contacts": [],
      "endpoints": [],
      "machineTags": [],
      "tags": [],
      "identifiers": [],
      "comments": [],
      "bibliography": [],
      "curatorialUnits": [],
      "taxonomicCoverages": [],
      "geographicCoverages": [],
      "temporalCoverages": [],
      "keywords": [],
      "purpose": "...",
      "additionalInfo": "...",
      "pubDate": "2024-01-01",
      "license": "CC_BY_4_0",
      "installationKey": "12345678-1234-1234-1234-123456789012",
      "recordCount": 150000000,
      "machineTags": []
    }
  ]
}
```

**Use Cases:**
- Dataset discovery
- Data source selection
- Citation information
- Publisher statistics

---

### 3.2 Dataset Detail

**Endpoint:** `GET /dataset/{key}`

**Purpose:** Get complete metadata for a single dataset.

**Parameters:**
- `key` (UUID, required, path): Dataset UUID

**Response:** Extended version of search result with full metadata, contacts, endpoints, etc.

---

### 3.3 Dataset Metadata (EML)

> **Correction (2026-10-18):** the endpoint returns 406 unless the request carries `Accept: application/xml`. The server sends that header and returns the document as text.

**Endpoint:** `GET /dataset/{key}/document`

**Purpose:** Retrieve the original EML (Ecological Metadata Language) document.

**Parameters:**
- `key` (UUID, required, path): Dataset UUID

**Response:** XML EML document

**Use Cases:**
- Full metadata access
- Citation generation
- Metadata harvesting

---

### 3.4 Dataset Metrics

**Endpoint:** `GET /dataset/{key}/metrics`

**Purpose:** Get occurrence counts and metrics for a dataset.

**Response Structure:**
```json
{
  "key": "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
  "datasetKey": "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
  "constituentKey": null,
  "occurrenceCount": 150000000,
  "georeferenced": 145000000,
  "year": {
    "2024": 5000000,
    "2023": 10000000
  },
  "basisOfRecord": {
    "HUMAN_OBSERVATION": 149000000,
    "MACHINE_OBSERVATION": 1000000
  },
  "country": {
    "US": 80000000,
    "CA": 20000000
  }
}
```

---

### 3.5 Dataset Constituents

**Endpoint:** `GET /dataset/{key}/constituents`

**Purpose:** For composite datasets, list constituent datasets.

**Parameters:**
- `key` (UUID, required, path): Parent dataset UUID
- `limit`, `offset`: Pagination

---

### 3.6 Dataset Networks

**Endpoint:** `GET /dataset/{key}/networks`

**Purpose:** List networks this dataset belongs to.

---

### 3.7 Organization Search

> **Correction (2026-10-18):** `/organization/search` returns 404. Search is `GET /organization` with the same query parameters.

**Endpoint:** `GET /organization/search`

**Purpose:** Search data publishers and hosting organizations.

**Parameters:**
- `q` (string, optional): Search query
- `country` (string, optional): ISO country code
- `isEndorsed` (boolean, optional): Endorsed by GBIF node
- `limit`, `offset`: Pagination

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 2345,
  "results": [
    {
      "key": "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
      "title": "Cornell Lab of Ornithology",
      "abbreviation": "CLO",
      "description": "...",
      "country": "US",
      "homepage": ["https://www.birds.cornell.edu"],
      "logoUrl": "https://...",
      "latitude": 42.4500,
      "longitude": -76.4500,
      "created": "2008-01-01T00:00:00.000+0000",
      "modified": "2024-01-15T10:00:00.000+0000",
      "contacts": [],
      "endpoints": [],
      "endorsingNodeKey": "a49e75d9-7b07-4d01-9be8-6ab2133f42f9",
      "endorsementApproved": true,
      "numPublishedDatasets": 15
    }
  ]
}
```

---

### 3.8 Organization Detail

**Endpoint:** `GET /organization/{key}`

**Purpose:** Get complete organization information.

**Parameters:**
- `key` (UUID, required, path): Organization UUID

---

### 3.9 Organization Datasets

**Endpoint:** `GET /organization/{key}/publishedDataset`

**Purpose:** List all datasets published by an organization.

**Parameters:**
- `key` (UUID, required, path): Organization UUID
- `type` (enum, optional): Filter by dataset type
- `limit`, `offset`: Pagination

---

### 3.10 Organization Installations

**Endpoint:** `GET /organization/{key}/installation`

**Purpose:** List technical installations (servers) managed by organization.

---

### 3.11 Installation Search

> **Correction (2026-10-18):** `/installation/search` returns 404; use `GET /installation`.

**Endpoint:** `GET /installation/search`

**Purpose:** Search technical installations (IPT servers, DiGIR, etc.).

**Parameters:**
- `q` (string, optional): Search query
- `type` (enum, optional): IPT_INSTALLATION, DIGIR_INSTALLATION, TAPIR_INSTALLATION, BIOCASE_INSTALLATION, HTTP_INSTALLATION
- `limit`, `offset`: Pagination

---

### 3.12 Installation Detail

**Endpoint:** `GET /installation/{key}`

**Purpose:** Get installation details.

**Parameters:**
- `key` (UUID, required, path): Installation UUID

---

### 3.13 Network Search

> **Correction (2026-10-18):** `/network/search` returns 404; use `GET /network`.

**Endpoint:** `GET /network/search`

**Purpose:** Search thematic networks of datasets.

**Parameters:**
- `q` (string, optional): Search query
- `limit`, `offset`: Pagination

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 123,
  "results": [
    {
      "key": "99d66b6c-9087-452f-a9d4-f15f2c2d0e7e",
      "title": "OBIS - Ocean Biodiversity Information System",
      "description": "...",
      "language": "en",
      "email": [],
      "phone": [],
      "homepage": ["https://obis.org"],
      "logoUrl": "https://...",
      "numConstituents": 456,
      "created": "2015-01-01T00:00:00.000+0000",
      "modified": "2024-01-15T10:00:00.000+0000"
    }
  ]
}
```

---

### 3.14 Network Detail

**Endpoint:** `GET /network/{key}`

**Purpose:** Get complete network information.

**Parameters:**
- `key` (UUID, required, path): Network UUID

---

### 3.15 Network Constituents

**Endpoint:** `GET /network/{key}/constituents`

**Purpose:** List datasets belonging to a network.

**Parameters:**
- `key` (UUID, required, path): Network UUID
- `limit`, `offset`: Pagination

---

### 3.16 Node Search

**Endpoint:** `GET /node/search`

**Purpose:** Search GBIF participant nodes (countries and organizations).

**Parameters:**
- `q` (string, optional): Search query
- `type` (enum, optional): COUNTRY, OTHER
- `participationStatus` (enum, optional): VOTING, ASSOCIATE, FORMER, AFFILIATE
- `limit`, `offset`: Pagination

---

### 3.17 Node Detail

**Endpoint:** `GET /node/{key}`

**Purpose:** Get GBIF node information.

**Parameters:**
- `key` (UUID, required, path): Node UUID

---

### 3.18 Collections

**Endpoint:** `GET /grscicoll/collection/search`

**Purpose:** Search GRSciColl (Global Registry of Scientific Collections).

**Parameters:**
- `q` (string, optional): Search query
- `code` (string, optional): Collection code
- `name` (string, optional): Collection name
- `country` (string, optional): Country code
- `city` (string, optional): City name
- `institutionKey` (UUID, optional): Parent institution UUID
- `limit`, `offset`: Pagination

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 8234,
  "results": [
    {
      "key": "12345678-1234-1234-1234-123456789012",
      "code": "HERB",
      "name": "University Herbarium",
      "description": "...",
      "contentTypes": ["PALEONTOLOGICAL_OTHER", "PRESERVED_SPECIMENS"],
      "active": true,
      "personalCollection": false,
      "doi": "10.15468/abc123",
      "numberSpecimens": 1500000,
      "taxonomicCoverage": "Vascular plants",
      "geographicCoverage": "North America",
      "institutionKey": "87654321-4321-4321-4321-210987654321",
      "mailingAddress": {},
      "address": {},
      "homepage": "https://...",
      "created": "2019-01-01T00:00:00.000+0000",
      "modified": "2024-01-15T10:00:00.000+0000"
    }
  ]
}
```

---

### 3.19 Institutions

**Endpoint:** `GET /grscicoll/institution/search`

**Purpose:** Search institutions in GRSciColl.

**Parameters:** Similar to collections search

---

### 3.20 Staff

**Endpoint:** `GET /grscicoll/person/search`

**Purpose:** Search collection staff and contacts.

---

## 4. Maps API

The Maps API provides raster tile services for visualizing occurrence data.

### 4.1 Map Tiles (Vector)

**Endpoint:** `GET /v2/map/occurrence/{z}/{x}/{y}.mvt`

**Purpose:** Get Mapbox Vector Tile (MVT) format tiles for occurrence data.

**Parameters (in URL path):**
- `z` (integer, required): Zoom level (0-20)
- `x` (integer, required): Tile column
- `y` (integer, required): Tile row

**Query Parameters (filters):**
All occurrence search filters supported, most commonly:
- `taxonKey`
- `datasetKey`
- `country`
- `year`
- `basisOfRecord`
- `bin`: Binning mode (hex, square)
- `hexPerTile`: Number of hexagons per tile
- `squareSize`: Size of square bins in pixels

**Bin Modes:**
- `hex`: Hexagonal binning (default)
- `square`: Square grid binning

**Response:** Binary MVT tile data (application/x-protobuf)

**Tile Coordinate System:**
- Standard web Mercator projection (EPSG:3857)
- TMS tile addressing scheme
- Zoom levels 0-20 supported

**Use Cases:**
- Interactive web maps
- Large-scale occurrence visualization
- Density heatmaps
- Geographic patterns

---

### 4.2 Point Map Tiles (Raster)

**Endpoint:** `GET /v2/map/occurrence/density/{z}/{x}/{y}@{scale}x.png`

**Purpose:** Pre-rendered raster tiles showing occurrence density.

**Parameters:**
- `z`, `x`, `y`: Tile coordinates
- `scale` (integer, optional): Pixel density (1, 2, 3 for retina displays)
- Query parameters: Same filters as vector tiles
- `style`: Color scheme (purpleHeat, orangeHeat, greenHeat, blueHeat, classic.point, etc.)
- `srs`: Spatial reference system (EPSG:3857 default, EPSG:4326 for plate carrée)

**Response:** PNG image (image/png)

**Color Styles:**
- `purpleHeat`: Purple density gradient (default)
- `orangeHeat`: Orange density gradient
- `greenHeat`: Green density gradient
- `blueHeat`: Blue density gradient
- `green.point`: Green points
- `green2.point`: Light green points
- `red.point`: Red points
- `orange.point`: Orange points
- `blue.point`: Blue points
- `classic.point`: Classic yellow points
- `poly.point`: Multi-color by kingdom

**Use Cases:**
- Simple map integration
- Static map generation
- Mobile applications
- Presentation materials

---

### 4.3 Adhoc Map (Static Image)

**Endpoint:** `GET /v2/map/occurrence/adhoc/{z}/{x}/{y}@{scale}x.png`

**Purpose:** Generate custom styled static maps on the fly.

**Parameters:**
- Standard tile coordinates
- All occurrence filters
- Advanced styling parameters:
  - `colors`: Custom color palette
  - `mode`: Rendering mode (GEO_BOUNDS, GEO_CENTROID, CLASSIC)

---

## 5. Literature API

The Literature API tracks scientific publications that cite GBIF-mediated data.

### 5.1 Literature Search

**Endpoint:** `GET /literature/search`

**Purpose:** Search scientific literature citing GBIF data.

**Parameters:**
- `q` (string, optional): Full-text search
- `countriesOfResearcher` (string, optional): ISO country codes of authors
- `countriesOfCoverage` (string, optional): Geographic coverage countries
- `literatureType` (enum, optional): JOURNAL, BOOK, CHAPTER, THESIS, CONFERENCE_PROCEEDINGS, WEB_PAGE, REPORT
- `relevance` (enum, optional): GBIF_USED, GBIF_CITED, GBIF_DISCUSSED, GBIF_PRIMARY, GBIF_ACKNOWLEDGED
- `topics` (string, optional): Research topics/keywords
- `year` (integer, optional): Publication year
- `source` (enum, optional): GBIF, MENDELEY, CROSSREF
- `peerReview` (boolean, optional): Peer-reviewed only
- `openAccess` (boolean, optional): Open access only
- `gbifDatasetKey` (UUID, optional): Specific dataset cited
- `publishingOrganizationKey` (UUID, optional): Publishing organization
- `gbifDownloadKey` (string, optional): Specific download cited
- `gbifOccurrenceKey` (integer, optional): Specific occurrence cited
- `limit` (integer, optional): Default 20, max 1000
- `offset` (integer, optional): Pagination

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 12567,
  "results": [
    {
      "id": "abc123def456",
      "title": "Global patterns of bird diversity",
      "authors": [
        {
          "firstName": "John",
          "lastName": "Smith"
        }
      ],
      "year": 2024,
      "source": "Journal of Biogeography",
      "identifiers": {
        "doi": "10.1111/jbi.12345"
      },
      "websites": ["https://doi.org/10.1111/jbi.12345"],
      "month": 3,
      "publisher": "Wiley",
      "day": 15,
      "created": "2024-03-15T00:00:00.000+0000",
      "abstract": "...",
      "keywords": ["biodiversity", "birds", "global patterns"],
      "literatureType": "JOURNAL",
      "relevance": "GBIF_USED",
      "countriesOfResearcher": ["US", "GB"],
      "countriesOfCoverage": ["US", "CA", "MX"],
      "topics": ["SPECIES_DISTRIBUTIONS"],
      "gbifDatasetKey": ["50c9509d-22c7-4a22-a47d-8c48425ef4a7"],
      "gbifDownloadKey": ["0001234-241115141502345"],
      "peerReview": true,
      "openAccess": true,
      "tags": []
    }
  ]
}
```

**Use Cases:**
- Citation tracking
- Impact assessment
- Research trend analysis
- Dataset usage statistics

---

### 5.2 Literature Detail

> **Correction (2026-10-18):** GBIF does not expose stable literature ids to callers. The server looks a paper up by DOI via `GET /literature/search?doi=<doi>&limit=1` and returns 404 when nothing matches.

**Endpoint:** `GET /literature/{id}`

**Purpose:** Get complete details for a single publication.

**Parameters:**
- `id` (string, required, path): Literature identifier

---

### 5.3 Literature Export

**Endpoint:** `GET /literature/export`

**Purpose:** Export literature results in BibTeX or other formats.

**Parameters:**
- Same as search
- `format` (enum, optional): BIBTEX, RIS, CSV

**Response:** Formatted citation export

---

## 6. Vocabularies API

The Vocabularies API provides access to controlled vocabularies and concepts used across GBIF.

### 6.1 Vocabulary List

**Endpoint:** `GET /vocabularies`

**Purpose:** List all available controlled vocabularies.

**Response Structure:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": true,
  "results": [
    {
      "key": 1,
      "name": "BasisOfRecord",
      "namespace": "http://rs.gbif.org/vocabulary/gbif/",
      "label": {
        "en": "Basis of Record"
      },
      "definition": {
        "en": "The specific nature of the data record"
      },
      "editorialNotes": [],
      "created": "2015-01-01T00:00:00.000+0000",
      "modified": "2024-01-15T10:00:00.000+0000"
    }
  ]
}
```

---

### 6.2 Vocabulary Detail

**Endpoint:** `GET /vocabularies/{name}`

**Purpose:** Get complete vocabulary with all concepts.

**Parameters:**
- `name` (string, required, path): Vocabulary name

**Response Structure:**
```json
{
  "key": 1,
  "name": "BasisOfRecord",
  "namespace": "http://rs.gbif.org/vocabulary/gbif/",
  "label": {
    "en": "Basis of Record"
  },
  "definition": {
    "en": "The specific nature of the data record"
  },
  "concepts": [
    {
      "name": "PRESERVED_SPECIMEN",
      "label": {
        "en": "Preserved Specimen"
      },
      "definition": {
        "en": "A specimen that has been preserved"
      },
      "externalDefinitions": [],
      "editorialNotes": [],
      "created": "2015-01-01T00:00:00.000+0000",
      "modified": "2024-01-15T10:00:00.000+0000"
    }
  ]
}
```

---

### 6.3 Concept Detail

**Endpoint:** `GET /vocabularies/{name}/concepts/{concept}`

**Purpose:** Get details for a single concept within a vocabulary.

**Parameters:**
- `name` (string, required, path): Vocabulary name
- `concept` (string, required, path): Concept name

---

### 6.4 Common Vocabularies

**Important GBIF Vocabularies:**
- `BasisOfRecord`: Nature of the record
- `TypeStatus`: Nomenclatural type information
- `EstablishmentMeans`: Native/introduced status
- `Pathway`: Introduction pathway
- `DegreeOfEstablishment`: Establishment status
- `OccurrenceStatus`: Present/absent
- `LifeStage`: Life stage of organism
- `Sex`: Sex of organism
- `License`: Data license types
- `Country`: ISO country codes
- `Language`: ISO language codes
- `Rank`: Taxonomic ranks
- `TaxonomicStatus`: Status of names
- `NomenclaturalStatus`: Nomenclatural status codes

---

## 7. Validator API

The Validator API provides data quality validation services for Darwin Core Archives and EML documents.

### 7.1 Validate DwC-A

**Endpoint:** `POST /validator/dwca`

**Purpose:** Validate a Darwin Core Archive file or URL.

**Request:**
- Content-Type: `multipart/form-data`
- Body: DwC-A file upload OR
- Body: JSON with `url` parameter pointing to archive

**Example JSON:**
```json
{
  "url": "http://example.org/dwca.zip"
}
```

**Response Structure:**
```json
{
  "status": "VALID",
  "issues": [
    {
      "issueType": "WARNING",
      "message": "Missing recommended field: coordinateUncertaintyInMeters",
      "rowNumber": 15,
      "column": "coordinateUncertaintyInMeters",
      "relatedData": "occurrence.txt"
    }
  ],
  "summary": {
    "totalRecords": 1000,
    "recordsWithIssues": 25,
    "errorCount": 0,
    "warningCount": 25,
    "infoCount": 5
  },
  "metadata": {
    "coreType": "Occurrence",
    "extensions": ["MultimediaExtension"],
    "emlValid": true
  }
}
```

**Validation Levels:**
- `ERROR`: Critical issues preventing processing
- `WARNING`: Best practice violations
- `INFO`: Informational messages

**Use Cases:**
- Pre-publication validation
- Data quality assurance
- Dataset preparation
- IPT integration testing

---

### 7.2 Validate EML

**Endpoint:** `POST /validator/eml`

**Purpose:** Validate an EML (Ecological Metadata Language) document.

**Request:**
- Content-Type: `application/xml` or `multipart/form-data`
- Body: EML XML document

**Response Structure:**
```json
{
  "valid": true,
  "schemaVersion": "2.1.1",
  "issues": []
}
```

---

### 7.3 Validate Data File

**Endpoint:** `POST /validator/tabular`

**Purpose:** Validate a tabular data file (CSV, TSV) against Darwin Core terms.

**Request:**
- Content-Type: `multipart/form-data`
- File: Data file
- Parameters:
  - `rowType`: Darwin Core record type (e.g., "http://rs.tdwg.org/dwc/terms/Occurrence")
  - `delimiter`: Field delimiter (comma, tab, pipe, etc.)

---

### 7.4 Data Quality Reports

**Endpoint:** `GET /validator/jobStatus/{jobId}`

**Purpose:** Check status of async validation job.

**Parameters:**
- `jobId` (string, required, path): Job identifier from validation request

**Response:**
```json
{
  "jobId": "abc123",
  "status": "FINISHED",
  "created": "2024-01-15T10:00:00.000+0000",
  "finished": "2024-01-15T10:05:00.000+0000",
  "reportUrl": "https://api.gbif.org/v1/validator/report/abc123"
}
```

---

## MCP Implementation Considerations

### High-Priority Endpoints (Most Commonly Used)

**Tier 1 - Essential:**
1. `GET /species/match` - Critical for name resolution
2. `GET /species/search` - Taxonomic discovery
3. `GET /species/{key}` - Species details
4. `GET /occurrence/search` - Primary data access
5. `GET /occurrence/{key}` - Record details
6. `GET /dataset/{key}` - Dataset metadata
7. `GET /organization/{key}` - Publisher information

**Tier 2 - Important:**
1. `GET /species/suggest` - Autocomplete
2. `GET /species/{key}/vernacularNames` - Common names
3. `GET /occurrence/count` - Quick statistics
4. `POST /occurrence/download/request` - Large data downloads
5. `GET /occurrence/download/{key}` - Download status
6. `GET /dataset/search` - Dataset discovery
7. `GET /literature/search` - Citation tracking
8. Map API endpoints - Visualization

**Tier 3 - Specialized:**
1. Parser endpoints - Name parsing
2. Validator endpoints - Data quality
3. Registry detail endpoints - Metadata management
4. Vocabularies - Reference data

---

### Pagination Patterns

**Standard REST Pagination:**
```
limit: Records per page (default: 20, max: usually 300)
offset: Starting record (0-indexed)
```

**Response indicators:**
```json
{
  "offset": 0,
  "limit": 20,
  "endOfRecords": false,
  "count": 12345,
  "results": [...]
}
```

**Occurrence Search Limits:**
- Maximum offset: 100,000 records
- For larger result sets, use Download API
- Faceted results don't count toward offset limit

**Best Practices:**
1. Check `endOfRecords` to detect last page
2. Use `count` for total results (may be approximate for very large sets)
3. Implement exponential backoff for retry logic
4. Cache frequently accessed pages

---

### Authentication Requirements

**No Authentication Required:**
- All GET endpoints for public data
- Species API (all endpoints)
- Occurrence search and detail
- Registry queries
- Maps API
- Literature API
- Vocabularies API
- Validator API (read operations)

**Authentication Required:**
- `POST /occurrence/download/request`
- `GET /occurrence/download/user/{username}`
- Dataset creation/modification (not covered - admin functions)
- Organization management (not covered - admin functions)

**Authentication Method:**
- HTTP Basic Authentication
- Username: GBIF account username
- Password: GBIF account password
- Header: `Authorization: Basic base64(username:password)`

**Alternative (for downloads):**
- Use pre-authenticated download keys
- Store credentials securely
- Never expose in client-side code

---

### Rate Limiting and Best Practices

**Official Policy:**
- No hard rate limits on public API
- Fair use policy applies
- Recommend 1-2 requests per second maximum

**Best Practices:**
1. **User-Agent Header:** Always identify your application
   ```
   User-Agent: MyApp/1.0 (https://myapp.com; contact@myapp.com)
   ```

2. **Respect Server Response Times:**
   - If responses slow, reduce request rate
   - Implement adaptive throttling

3. **Caching:**
   - Cache taxonomy lookups (rarely change)
   - Cache dataset metadata
   - Don't cache live occurrence counts

4. **Batch Requests:**
   - Use bulk parser endpoint for multiple names
   - Use download API for large occurrence sets
   - Aggregate queries when possible

5. **Error Handling:**
   - 400: Bad request - check parameters
   - 404: Not found - resource doesn't exist
   - 500: Server error - retry with exponential backoff
   - 503: Service unavailable - wait before retry

6. **Connection Management:**
   - Use persistent connections (keep-alive)
   - Pool connections for multiple requests
   - Set reasonable timeouts (30-60 seconds)

---

### Response Format Considerations

**Default Format:** JSON (application/json)

**Alternative Formats (where available):**
- XML (text/xml) - Add `Accept: text/xml` header
- CSV - Some endpoints support `/export` variants
- Darwin Core Archive - Download API
- Parquet - Download API (for big data workflows)

**Content Negotiation:**
```http
Accept: application/json
Accept-Language: en
```

---

### MCP Tool Design Recommendations

**1. Name Resolution Tool:**
```typescript
{
  name: "gbif_match_name",
  description: "Match scientific name to GBIF taxonomy",
  parameters: {
    name: "Scientific name",
    kingdom: "Optional taxonomic context",
    strict: "Strict matching mode"
  }
}
```

**2. Occurrence Search Tool:**
```typescript
{
  name: "gbif_search_occurrences",
  description: "Search occurrence records with filters",
  parameters: {
    taxonKey: "GBIF taxon key",
    country: "ISO country code",
    year: "Year or range",
    hasCoordinate: "Only georeferenced records",
    limit: "Results per page",
    // ... other filters
  }
}
```

**3. Species Info Tool:**
```typescript
{
  name: "gbif_get_species",
  description: "Get complete species information",
  parameters: {
    key: "GBIF taxon key"
  }
}
```

**4. Dataset Info Tool:**
```typescript
{
  name: "gbif_get_dataset",
  description: "Get dataset metadata",
  parameters: {
    key: "Dataset UUID"
  }
}
```

**5. Download Request Tool:**
```typescript
{
  name: "gbif_request_download",
  description: "Request occurrence data download",
  parameters: {
    filters: "Download predicate filters",
    format: "Download format",
    email: "Notification email"
  },
  requiresAuth: true
}
```

---

### Error Handling Patterns

**Standard HTTP Status Codes:**

**200 OK:**
- Successful request
- Response contains data

**204 No Content:**
- Successful request
- No content to return

**400 Bad Request:**
- Invalid parameters
- Malformed query
- Check parameter values and types

**401 Unauthorized:**
- Authentication required
- Invalid credentials

**404 Not Found:**
- Resource doesn't exist
- Invalid key/UUID
- Deleted or never existed

**406 Not Acceptable:**
- Unsupported Accept header
- Format not available

**414 URI Too Long:**
- URL exceeds length limits
- Use POST method or simplify query

**500 Internal Server Error:**
- Server-side error
- Retry with exponential backoff

**503 Service Unavailable:**
- Temporary outage
- Maintenance
- Rate limiting (soft)
- Wait and retry

**Retry Strategy:**
```javascript
const retryDelays = [1000, 2000, 4000, 8000]; // Exponential backoff
for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
  try {
    const response = await fetch(url);
    if (response.ok) return response;
    if (response.status < 500) throw new Error("Client error");
  } catch (error) {
    if (attempt === retryDelays.length) throw error;
    await sleep(retryDelays[attempt]);
  }
}
```

---

### Data Quality Considerations

**When Processing Occurrence Data:**

1. **Check for Issues:**
   - `issues` array contains data quality flags
   - Common issues:
     - `ZERO_COORDINATE`: Lat/lon at 0,0
     - `COUNTRY_COORDINATE_MISMATCH`: Coordinates don't match country
     - `RECORDED_DATE_INVALID`: Invalid date format
     - `TAXON_MATCH_FUZZY`: Taxonomy matched fuzzily

2. **Coordinate Validation:**
   - Check `hasCoordinate` = true
   - Validate `coordinateUncertaintyInMeters`
   - Verify `geodeticDatum` (prefer WGS84)
   - Check for `hasGeospatialIssue` = false

3. **Taxonomic Validation:**
   - Use `acceptedTaxonKey` for current taxonomy
   - Check `taxonomicStatus` = "ACCEPTED"
   - Verify complete classification present

4. **Temporal Validation:**
   - Check year range is reasonable
   - Validate `eventDate` format
   - Consider `modified` and `lastInterpreted` dates

---

### Performance Optimization

**1. Query Optimization:**
- Use specific taxon keys instead of names when possible
- Limit geographic extent with bounding boxes
- Use `limit` parameter appropriately (don't request more than needed)
- Leverage faceting for aggregations instead of counting

**2. Caching Strategy:**
```javascript
// Long-term cache (taxonomic data - changes rarely)
const TAXONOMY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Medium-term cache (dataset metadata)
const METADATA_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day

// Short-term cache (occurrence counts)
const COUNT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// No cache (occurrence searches - data changes frequently)
```

**3. Parallel Requests:**
- Fetch species info and occurrences in parallel
- Batch name matching requests
- Use Promise.all() for independent queries

**4. Streaming Large Results:**
- Use download API for > 100,000 records
- Process occurrence data in chunks
- Consider Parquet format for very large downloads

---

### Darwin Core Term Reference

**Most Important Terms (for occurrence records):**

**Taxonomic:**
- `scientificName`: Full scientific name
- `kingdom`, `phylum`, `class`, `order`, `family`, `genus`, `species`: Classification
- `taxonRank`: Rank of the taxon
- `taxonomicStatus`: ACCEPTED, SYNONYM, etc.
- `acceptedNameUsage`: Accepted name if synonym

**Geographic:**
- `decimalLatitude`, `decimalLongitude`: Coordinates
- `coordinateUncertaintyInMeters`: Precision
- `geodeticDatum`: Coordinate reference system
- `country`, `countryCode`: Country information
- `stateProvince`, `county`, `municipality`: Administrative areas
- `locality`: Specific location description

**Temporal:**
- `eventDate`: ISO 8601 date/time
- `year`, `month`, `day`: Date components
- `startDayOfYear`, `endDayOfYear`: Julian dates

**Record-level:**
- `basisOfRecord`: Nature of record
- `occurrenceStatus`: PRESENT or ABSENT
- `establishmentMeans`: Native/introduced
- `occurrenceID`: Unique identifier
- `catalogNumber`: Museum/collection catalog number
- `recordedBy`: Collector/observer
- `identifiedBy`: Identifier/determiner
- `preparations`: Specimen preparation

**Dataset-level:**
- `datasetKey`: GBIF dataset UUID
- `publishingOrgKey`: Publisher UUID
- `institutionCode`: Institution code
- `collectionCode`: Collection code
- `license`: Data license

---

### Special Considerations for MCP

**1. Context Management:**
- Maintain session state for multi-step queries
- Cache user's recent taxon keys
- Remember selected datasets/filters

**2. Natural Language Processing:**
- Parse user queries for taxonomic names
- Extract geographic references (countries, coordinates)
- Identify temporal filters (years, date ranges)
- Detect filter intentions (only georeferenced, with images, etc.)

**3. Result Presentation:**
- Format large numbers with commas
- Convert dates to readable formats
- Show taxonomic hierarchy clearly
- Include links to GBIF portal for details
- Summarize large result sets

**4. Disambiguation:**
- Handle homonyms (same name, different kingdoms)
- Offer alternatives for fuzzy matches
- Clarify synonym vs accepted names
- Explain match confidence scores

**5. Educational Context:**
- Explain data quality issues
- Define technical terms (Darwin Core terms, etc.)
- Provide context for empty results
- Suggest alternative queries

---

### Example MCP Interaction Flow

**User:** "How many mountain lion observations are there in California?"

**MCP Actions:**
1. Call `gbif_match_name` with name="Puma concolor"
   - Get taxonKey: 2435099
2. Call `gbif_count_occurrences` with:
   - taxonKey=2435099
   - country=US
   - stateProvince=California
   - basisOfRecord=HUMAN_OBSERVATION
3. Present result: "There are 12,456 mountain lion observations in California"

**Follow-up:** "Show me the most recent ones"

**MCP Actions:**
1. Call `gbif_search_occurrences` with:
   - taxonKey=2435099
   - country=US
   - stateProvince=California
   - basisOfRecord=HUMAN_OBSERVATION
   - limit=10
   - Sort by most recent (implicit or explicit parameter)
2. Present formatted results with dates, locations, observers

---

### API Stability and Versioning

**Current Version:** v1 (stable since 2012)

**Stability Guarantees:**
- v1 endpoints are stable and backward compatible
- New fields may be added to responses
- Existing fields won't be removed without deprecation notice
- Filter parameters remain consistent

**Future-Proofing:**
- Monitor GBIF Developer announcements
- Handle unknown response fields gracefully
- Implement version checking in client
- Log API responses for debugging

**Deprecation Policy:**
- Minimum 6 months notice for breaking changes
- Alternative endpoints provided
- Migration guides published

---

### Additional Resources

**Official Documentation:**
- API Reference: https://www.gbif.org/developer/summary
- Darwin Core Standard: https://dwc.tdwg.org/
- Data Quality Requirements: https://data-blog.gbif.org/

**Support:**
- Helpdesk: helpdesk@gbif.org
- Developer Forum: https://discourse.gbif.org/
- GitHub Issues: https://github.com/gbif/gbif-api/issues

**Tools and Libraries:**
- GBIF API clients: Available for Python (pygbif), R (rgbif), Java
- Data validation: GBIF Data Validator web tool
- IPT (Integrated Publishing Toolkit): For data publishing

---

## Summary Table: Endpoint Priority for MCP

| Priority | Endpoint | Use Case | Auth Required |
|----------|----------|----------|---------------|
| HIGH | `/species/match` | Name resolution | No |
| HIGH | `/species/search` | Taxonomy search | No |
| HIGH | `/species/{key}` | Species details | No |
| HIGH | `/occurrence/search` | Data access | No |
| HIGH | `/occurrence/count` | Quick stats | No |
| HIGH | `/dataset/{key}` | Metadata | No |
| MEDIUM | `/species/suggest` | Autocomplete | No |
| MEDIUM | `/species/{key}/vernacularNames` | Common names | No |
| MEDIUM | `/occurrence/{key}` | Record details | No |
| MEDIUM | `/occurrence/download/request` | Large downloads | YES |
| MEDIUM | `/dataset/search` | Discovery | No |
| MEDIUM | `/organization/{key}` | Publishers | No |
| MEDIUM | `/literature/search` | Citations | No |
| LOW | `/parser/name` | Name parsing | No |
| LOW | `/species/{key}/children` | Taxonomy tree | No |
| LOW | `/species/{key}/parents` | Classification | No |
| LOW | `/validator/*` | Validation | No |
| LOW | `/vocabularies/*` | Reference data | No |

This analysis provides a comprehensive foundation for implementing GBIF API access in an MCP server, covering all major endpoint categories with practical implementation guidance.
