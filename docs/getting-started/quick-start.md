# Quick Start

Get started with the GBIF MCP Server in 5 minutes. This guide walks through your first queries and introduces the main tool categories.

## Your First Query

### 1. Start the Server

```bash
npm start
# or
docker run -i gbif-mcp
```

The server communicates via stdin/stdout using the MCP protocol.

### 2. Search for a Species

Find species by name:

```json
{
  "tool": "gbif_species_search",
  "arguments": {
    "q": "Panthera leo",
    "limit": 5
  }
}
```

**Response:** List of matching species with taxonomy

### 3. Get Occurrence Data

Find lion observations in Kenya:

```json
{
  "tool": "gbif_occurrence_search",
  "arguments": {
    "taxonKey": 5231190,
    "country": "KE",
    "year": "2020,2024",
    "hasCoordinate": true,
    "limit": 10
  }
}
```

**Response:** Georeferenced lion occurrences from 2020-2024

### 4. Get Quick Statistics

Count occurrences by year:

```json
{
  "tool": "gbif_occurrence_counts_by_year",
  "arguments": {
    "taxonKey": 5231190,
    "country": "KE"
  }
}
```

**Response:** `{ "2020": 45, "2021": 67, "2022": 89, "2023": 112, "2024": 134 }`

## Tool Categories

### 🔍 Species Tools (14 tools)

Taxonomy, identification, and species information:

- **Search** - Find species by name, filters
- **Match** - Fuzzy name matching
- **Parse Names** - Standardize scientific names
- **Metrics** - Quick species statistics
- **Related** - Find similar species

[See all species tools →](../api-reference/tools.md#species-tools-14)

### 📊 Occurrence Tools (14 tools)

Observation and specimen records:

- **Search** - Filter by space/time/taxonomy
- **Count** - Fast total counts
- **Statistics Suite** - 7 breakdown endpoints
- **Downloads** - Large dataset exports

[See all occurrence tools →](../api-reference/tools.md#occurrence-tools-14)

### 📚 Registry Tools (18 tools)

Dataset and institutional metadata:

- **Datasets** - Search, discover, analyze
- **Organizations** - Find data publishers
- **GRSciColl** - Natural history collections
- **Nodes** - GBIF participant info

[See all registry tools →](../api-reference/tools.md#registry-tools-18)

### 🗺️ Maps Tools (4 tools)

Visualization and tile generation:

- Generate occurrence map tiles
- Vector (MVT) and raster (PNG) formats
- Custom styling and filters

[See all maps tools →](../api-reference/tools.md#maps-tools-4)

## Common Workflows

### Find Data About a Species

```json
// 1. Search for species
{"tool": "gbif_species_search", "arguments": {"q": "African lion"}}

// 2. Get occurrence count
{"tool": "gbif_occurrence_count", "arguments": {"taxonKey": 5231190}}

// 3. Get geographic distribution
{"tool": "gbif_occurrence_counts_by_country", "arguments": {"taxonKey": 5231190}}

// 4. Get temporal trends
{"tool": "gbif_occurrence_counts_by_year", "arguments": {"taxonKey": 5231190}}
```

### Discover Datasets

```json
// 1. Search datasets
{"tool": "gbif_registry_search_datasets", "arguments": {"q": "mammals", "type": "OCCURRENCE"}}

// 2. Get dataset details
{"tool": "gbif_registry_get_dataset", "arguments": {"key": "dataset-uuid"}}

// 3. Get dataset statistics
{"tool": "gbif_registry_dataset_metrics", "arguments": {"key": "dataset-uuid"}}
```

### Validate Your Data

```json
// 1. Validate CSV file
{"tool": "gbif_validator_validate_tabular", "arguments": {"fileUrl": "https://example.com/data.csv"}}

// 2. Validate Darwin Core Archive
{"tool": "gbif_validator_validate_dwca", "arguments": {"fileUrl": "https://example.com/archive.zip"}}

// 3. Check validation status
{"tool": "gbif_validator_get_status", "arguments": {"validationKey": "job-123"}}
```

## Response Format

All tools return responses in this format:

```json
{
  "success": true,
  "data": { /* actual results */ },
  "metadata": {
    "tool": "tool_name",
    "timestamp": "2024-02-03T12:00:00Z",
    /* tool-specific metadata */
  }
}
```

## Next Steps

- [Explore all 58 tools](../user-guide/overview.md)
- [See advanced examples](../examples/basic-queries.md)
- [Configure the server](configuration.md)
- [Learn the architecture](../ARCHITECTURE.md)

## Tips

!!! tip "Performance"
    - Use count endpoints instead of full searches for statistics
    - Enable caching for frequently-accessed data
    - Use appropriate limit values (default: 20)

!!! warning "Rate Limiting"
    GBIF API has rate limits. The server includes:
    - Automatic retry with exponential backoff
    - Circuit breaker for resilience
    - Request queueing

!!! info "Authentication"
    Some endpoints require GBIF credentials:
    - Occurrence downloads
    - Dataset publishing

    Set `GBIF_USERNAME` and `GBIF_PASSWORD` environment variables.
