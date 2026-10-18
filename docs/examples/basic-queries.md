# Basic Query Examples

Real-world examples demonstrating common GBIF MCP Server use cases.

## Species Identification

### Find a Species by Name

```json
{
  "tool": "gbif_species_search",
  "arguments": {
    "q": "African lion"
  }
}
```

**Result:** Species matching "African lion" with GBIF keys

### Get Exact Species Match

```json
{
  "tool": "gbif_species_match",
  "arguments": {
    "name": "Panthera leo",
    "strict": true
  }
}
```

**Result:** Exact match with confidence score and alternatives

### Parse Scientific Names

```json
{
  "tool": "gbif_species_parse_names",
  "arguments": {
    "names": [
      "Panthera leo (Linnaeus, 1758)",
      "Puma concolor",
      "Felis catus Linnaeus"
    ]
  }
}
```

**Result:** Parsed components for each name (genus, species, author, year)

## Occurrence Queries

### Find Recent Observations

```json
{
  "tool": "gbif_occurrence_search",
  "arguments": {
    "taxonKey": 5231190,
    "year": "2024",
    "hasCoordinate": true,
    "limit": 20
  }
}
```

**Result:** 2024 lion observations with coordinates

### Count Occurrences

```json
{
  "tool": "gbif_occurrence_count",
  "arguments": {
    "taxonKey": 212,
    "country": "US",
    "basisOfRecord": ["HUMAN_OBSERVATION"]
  }
}
```

**Result:** Total count of bird observations in USA

### Geographic Distribution

```json
{
  "tool": "gbif_occurrence_counts_by_country",
  "arguments": {
    "taxonKey": 5231190,
    "year": "2020,2024"
  }
}
```

**Result:** `{ "KE": 234, "TZ": 156, "ZA": 189, ... }`

## Statistics & Analysis

### Temporal Trends

```json
{
  "tool": "gbif_occurrence_counts_by_year",
  "arguments": {
    "taxonKey": 5231190,
    "country": "KE"
  }
}
```

**Result:** Year-by-year counts for lions in Kenya

### Data Composition

```json
{
  "tool": "gbif_occurrence_counts_by_basis_of_record",
  "arguments": {
    "taxonKey": 212,
    "country": "US"
  }
}
```

**Result:** Breakdown of US bird records by type

### Dataset Attribution

```json
{
  "tool": "gbif_occurrence_counts_by_dataset",
  "arguments": {
    "taxonKey": 212,
    "country": "BR"
  }
}
```

**Result:** Which datasets contribute Brazilian bird data

## Dataset Discovery

### Find Occurrence Datasets

```json
{
  "tool": "gbif_registry_search_datasets",
  "arguments": {
    "type": "OCCURRENCE",
    "publishingCountry": "US",
    "q": "birds"
  }
}
```

### Get Dataset Details

```json
{
  "tool": "gbif_registry_get_dataset",
  "arguments": {
    "key": "50c9509d-22c7-4a22-a47d-8c48425ef4a7"
  }
}
```

### Get Dataset Statistics

```json
{
  "tool": "gbif_registry_dataset_metrics",
  "arguments": {
    "key": "50c9509d-22c7-4a22-a47d-8c48425ef4a7"
  }
}
```

## Map Generation

### Generate Map Tile URL

```json
{
  "tool": "gbif_maps_get_tile_url",
  "arguments": {
    "z": 4,
    "x": 3,
    "y": 5,
    "taxonKey": 212,
    "country": "US",
    "style": "purpleHeat.point"
  }
}
```

**Result:** URL to PNG tile showing US bird occurrences

### List Available Styles

```json
{
  "tool": "gbif_maps_list_styles",
  "arguments": {}
}
```

**Result:** All color schemes (classic.poly, purpleHeat.point, fire.point, etc.)

## Data Validation

### Validate CSV File

```json
{
  "tool": "gbif_validator_validate_tabular",
  "arguments": {
    "fileUrl": "https://example.com/occurrences.csv",
    "fileType": "CSV"
  }
}
```

### Validate Darwin Core Archive

```json
{
  "tool": "gbif_validator_validate_dwca",
  "arguments": {
    "fileUrl": "https://example.com/dataset.zip"
  }
}
```

## Research Impact

### Find Publications

```json
{
  "tool": "gbif_literature_search",
  "arguments": {
    "year": "2024",
    "topics": ["CONSERVATION", "CLIMATE_CHANGE"],
    "peerReview": true
  }
}
```

### Get Publication Details

```json
{
  "tool": "gbif_literature_get",
  "arguments": {
    "doi": "10.1038/nature12345"
  }
}
```

## Institutional Discovery

### Find Collections

```json
{
  "tool": "gbif_registry_search_collections",
  "arguments": {
    "country": "US",
    "q": "herbarium"
  }
}
```

### Find Institutions

```json
{
  "tool": "gbif_registry_search_institutions",
  "arguments": {
    "country": "GB",
    "city": "London"
  }
}
```

## Next Steps

- [User Guide](../user-guide/overview.md)
- [API Reference](../api-reference/tools.md)
