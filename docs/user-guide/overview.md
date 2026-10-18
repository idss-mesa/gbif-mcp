# User Guide Overview

Complete guide to all 58 GBIF MCP tools organized by category.

## Tool Categories

The GBIF MCP Server provides **57 tools** across **7 major categories**, each serving specific biodiversity data needs.

### 📊 Tool Distribution

| Category | Tools | Coverage | Use Cases |
|----------|-------|----------|-----------|
| [Species](../api-reference/tools.md#species-tools-14) | 14 | 70% | Taxonomy, identification, name parsing |
| [Occurrence](../api-reference/tools.md#occurrence-tools-14) | 14 | 56% | Observations, specimens, statistics |
| [Registry](../api-reference/tools.md#registry-tools-18) | 18 | 57% | Datasets, institutions, metadata |
| [Maps](../api-reference/tools.md#maps-tools-4) | 4 | 67% | Visualization, tile generation |
| [Statistics](../api-reference/tools.md#occurrence-tools-14) | 7 | - | Counts, trends, analysis |
| [Literature](../api-reference/tools.md#literature-tools-2) | 2 | 50% | Research impact |
| [Vocabularies](../api-reference/tools.md#vocabularies-tools-3) | 3 | 60% | Standards, valid values |
| [Validator](../api-reference/tools.md#validator-tools-3) | 3 | 30% | Quality assurance |

## Quick Reference

### Species & Taxonomy

```json
gbif_species_search          // Search species by name/filters
gbif_species_match           // Fuzzy name matching
gbif_species_parse_names     // Standardize scientific names (batch)
gbif_species_metrics         // Quick statistics
gbif_species_related         // Find related species
```

### Occurrences & Observations

```json
gbif_occurrence_search       // Query with filters
gbif_occurrence_count        // Fast total count
gbif_occurrence_counts_*     // 7 breakdown endpoints
gbif_occurrence_download_*   // Large dataset exports
```

### Statistics Suite (7 tools)

```json
gbif_occurrence_counts_by_basis_of_record     // By record type
gbif_occurrence_counts_by_year                // Temporal trends
gbif_occurrence_counts_by_country             // Geographic
gbif_occurrence_counts_by_publishing_country  // Data sources
gbif_occurrence_counts_by_dataset             // Attribution
gbif_occurrence_counts_by_taxon               // Biodiversity
gbif_occurrence_counts_by_publishing_org      // Institutions
```

### Datasets & Metadata

```json
gbif_registry_search_datasets      // Find datasets
gbif_registry_get_dataset          // Get metadata
gbif_registry_dataset_metrics      // Statistics
gbif_registry_dataset_document     // EML metadata
```

### Maps & Visualization

```json
gbif_maps_get_tile_url            // Generate tile URLs
gbif_maps_get_vector_tile_url     // MVT format
gbif_maps_get_raster_tile_url     // PNG format
gbif_maps_list_styles             // Available styles
```

## Tool Selection Guide

### When to Use What

**Need species information?**
→ Start with `gbif_species_search` or `gbif_species_match`

**Need occurrence data?**
→ Use `gbif_occurrence_search` for records
→ Use `gbif_occurrence_count` for totals
→ Use `gbif_occurrence_counts_*` for breakdowns

**Need quick statistics?**
→ Use the 7 `counts_*` tools (very fast)

**Need to find datasets?**
→ Start with `gbif_registry_search_datasets`

**Need to validate data?**
→ Use `gbif_validator_validate_tabular` (CSV)
→ Use `gbif_validator_validate_dwca` (archives)

**Need visualizations?**
→ Use `gbif_maps_*` tools to generate tile URLs

## Common Parameters

Most tools support these common parameters:

### Pagination

```json
{
  "limit": 20,    // Results per page (1-1000, default: 20)
  "offset": 0     // Skip first N results (default: 0)
}
```

### Taxonomic Filters

```json
{
  "taxonKey": 5231190,       // Specific taxon
  "kingdomKey": 1,           // Kingdom level
  "phylumKey": 44,           // Phylum level
  "classKey": 212,           // Class level (e.g., Aves)
  "orderKey": 7192402,       // Order level
  "familyKey": 9703,         // Family level
  "genusKey": 2435098        // Genus level
}
```

### Geographic Filters

```json
{
  "country": "KE",                    // 2-letter ISO code
  "continent": "AFRICA",              // Continent
  "hasCoordinate": true,              // Only georeferenced
  "decimalLatitude": "-1.5,1.5",      // Lat range
  "decimalLongitude": "35,37",        // Lon range
  "geometry": "POLYGON(...)"          // WKT geometry
}
```

### Temporal Filters

```json
{
  "year": "2024",            // Single year
  "year": "2020,2024",       // Year range
  "month": 6,                // Month (1-12)
  "eventDate": "2024-01-01"  // Specific date
}
```

## Response Patterns

### Paginated Results

```json
{
  "success": true,
  "data": {
    "offset": 0,
    "limit": 20,
    "endOfRecords": false,
    "count": 1000,
    "results": [ /* array of results */ ]
  }
}
```

### Count Results

```json
{
  "success": true,
  "data": {
    "count": 15000
  }
}
```

### Breakdown Results

```json
{
  "success": true,
  "data": {
    "US": 5000,
    "BR": 3000,
    "KE": 2000
  }
}
```

## Best Practices

!!! success "Do"
    - Use count endpoints for quick stats
    - Filter to reduce result sets
    - Cache frequently-used queries
    - Use appropriate pagination
    - Validate UUIDs before requests

!!! failure "Don't"
    - Request huge offsets (max: 100,000)
    - Use search when count suffices
    - Skip error handling
    - Ignore rate limits

## Error Handling

All tools return errors in standard format:

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE"
}
```

Common errors:
- `Invalid input` - Check parameter types/formats
- `Not found` - UUID doesn't exist
- `Rate limit exceeded` - Retry with backoff
- `Circuit breaker is OPEN` - GBIF API temporarily unavailable

## Next Steps

- [Explore Species Tools](../api-reference/tools.md#species-tools-14)
- [Explore Occurrence Tools](../api-reference/tools.md#occurrence-tools-14)
- [See Examples](../examples/basic-queries.md)
- [Configure the Server](../getting-started/configuration.md)
