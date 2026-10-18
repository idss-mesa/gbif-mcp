# GBIF MCP Server Implementation Plan

> **Status (updated 2026-10-18, v1.1.0).** This document is a historical snapshot from November 2025 (the original build plan)
> and is kept for the project record. Since it was written the server has grown to **58 tools**
> (14 species, 14 occurrence, 18 registry, 4 maps, 2 literature, 3 vocabularies, 3 validator),
> moved to **MCP protocol revision 2026-07-28** on the v2 TypeScript SDK (Node 20+, 2025-era
> clients still served), repaired retired GBIF endpoints (occurrence counts now use faceted
> search; `/parser/name`, `/organization`, `/network`, `/installation`, EML documents and
> literature-by-DOI fixed), and gained an agent install script. Tests: 261 unit, 32 protocol
> conformance, plus a 58-tool adversarial matrix against the live API. The repository now lives
> at <https://github.com/idss-mesa/gbif-mcp>. Current references: [README.md](README.md),
> [TOOLS.md](TOOLS.md), [CLAUDE.md](CLAUDE.md). The plan's SDK, Node and tool-count assumptions are superseded by the notes in this banner; the phase structure was followed.

## Overview

This document outlines the complete implementation plan for building a Model Context Protocol (MCP) server that provides access to the Global Biodiversity Information Facility (GBIF) API. The plan is structured in phases to ensure systematic development and testing.

## Prerequisites

- Node.js v20+ and npm (v18 was the original target; the v2 MCP SDK needs 20)
- TypeScript knowledge
- Understanding of MCP protocol
- GBIF API documentation (https://techdocs.gbif.org/en/openapi/)
- Optional: GBIF user account for authenticated endpoints

## Phase 1: Project Setup and Foundation (Days 1-2)

### 1.1 Initialize Project Structure

```bash
# Create directory structure
mkdir -p src/{config,core,services,tools,types,utils}
mkdir -p src/services/{species,occurrence,registry,maps,literature,vocabularies,validator}
mkdir -p src/tools/{species,occurrence,registry,maps,literature,vocabularies,validator}
mkdir -p tests/{unit,integration}
mkdir -p docs
```

### 1.2 Install Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/server": "^2.3.1",
    "axios": "^1.6.0",
    "p-queue": "^8.0.0",
    "lru-cache": "^10.0.0",
    "zod": "^3.22.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "msw": "^2.0.0",
    "tsx": "^4.7.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "prettier": "^3.1.0"
  }
}
```

### 1.3 Configure TypeScript

Create `tsconfig.json` with strict typing, ESM modules, and Node.js target.

### 1.4 Set Up Environment Configuration

- Create `.env` from `.env.example`
- Implement Zod-based config validation in `src/config/config.ts`
- Include GBIF credentials, rate limits, cache settings

## Phase 2: Core Infrastructure (Days 3-4)

### 2.1 Implement GBIF HTTP Client

**File: `src/core/gbif-client.ts`**

Features to implement:
- HTTP client with axios
- Rate limiting (100 req/min default)
- Exponential backoff retry logic
- Request/response interceptors
- Authentication header injection
- LRU cache (100MB default)
- Circuit breaker pattern
- Request queue management

### 2.2 Create Base Tool Architecture

**File: `src/tools/base-tool.ts`**

Implement abstract base class with:
- Input/output validation using Zod
- Automatic JSON Schema generation
- Error handling wrapper
- Response formatting
- Logging integration

### 2.3 Set Up Tool Registry

**File: `src/core/tool-registry.ts`**

- Dynamic tool registration
- Tool discovery mechanism
- Validation and error handling

### 2.4 Implement Logger

**File: `src/utils/logger.ts`**

- Winston-based structured logging
- Different log levels for dev/prod
- Request/response logging
- Error tracking

## Phase 3: MCP Protocol Layer (Days 5-6)

### 3.1 Create MCP Server

**File: `src/index.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

// Initialize server with:
// - Tool registration
// - Protocol handlers
// - Error boundaries
// - Graceful shutdown
```

### 3.2 Implement Protocol Handlers

- Tool execution handler
- Resource listing (if needed)
- Prompt templates (optional)
- Error response formatting

### 3.3 Set Up Transport Layer

- Stdio transport for Claude Desktop
- Connection lifecycle management
- Message serialization/deserialization

## Phase 4: GBIF Service Implementation (Days 7-14)

### 4.1 Species Service (Priority: HIGH)

**File: `src/services/species/species-service.ts`**

Implement endpoints:
- `/species/search` - Full-text species search
- `/species/{key}` - Get species by key
- `/species/match` - Fuzzy name matching
- `/species/suggest` - Autocomplete suggestions
- `/species/{key}/vernacularNames` - Common names
- `/species/{key}/synonyms` - Scientific synonyms
- `/species/{key}/children` - Taxonomic children
- `/species/{key}/parents` - Taxonomic hierarchy

### 4.2 Occurrence Service (Priority: HIGH)

**File: `src/services/occurrence/occurrence-service.ts`**

Implement endpoints:
- `/occurrence/search` - Search occurrences with filters
- `/occurrence/{key}` - Get single occurrence
- `/occurrence/count` - Count matching occurrences
- `/occurrence/download/request` - Request download
- `/occurrence/facet` - Faceted search

Key filters to support:
- taxonKey, scientificName
- country, continent
- year, month, eventDate
- datasetKey, publishingOrg
- hasCoordinate, hasGeospatialIssue
- basisOfRecord, typeStatus

### 4.3 Registry Service (Priority: MEDIUM)

**File: `src/services/registry/registry-service.ts`**

Implement endpoints:
- `/dataset/search` - Search datasets
- `/dataset/{key}` - Get dataset details
- `/organization/search` - Search organizations
- `/organization/{key}` - Get organization details
- `/network` - List networks

### 4.4 Maps Service (Priority: MEDIUM)

**File: `src/services/maps/maps-service.ts`**

Implement endpoints:
- `/map/occurrence/tile` - Generate map tiles
- Support formats: MVT, PNG
- Parameters: style, srs, bin, hexPerTile

### 4.5 Literature Service (Priority: LOW)

**File: `src/services/literature/literature-service.ts`**

Implement endpoints:
- `/literature/search` - Search publications
- Support filtering by DOI, dataset citation

### 4.6 Vocabularies Service (Priority: LOW)

**File: `src/services/vocabularies/vocabularies-service.ts`**

Implement endpoints:
- `/vocabularies` - List vocabularies
- `/vocabularies/{name}/concepts` - Get concepts

### 4.7 Validator Service (Priority: LOW)

**File: `src/services/validator/validator-service.ts`**

Implement endpoints:
- `/validator/validate` - Validate DwC-A
- `/validator/eml` - Validate EML

## Phase 5: MCP Tool Implementation (Days 15-18)

### 5.1 Create Tool Wrappers

For each service, create corresponding MCP tools:

**Example: Species Search Tool**
```typescript
// src/tools/species/search-species-tool.ts
export class SearchSpeciesTool extends BaseTool {
  name = 'gbif_species_search';
  description = 'Search for species in GBIF taxonomy';

  inputSchema = z.object({
    q: z.string().describe('Search query'),
    rank: z.enum(['KINGDOM', 'PHYLUM', 'CLASS', ...]).optional(),
    limit: z.number().min(1).max(100).default(20)
  });

  async execute(input: SearchSpeciesInput): Promise<ToolResponse> {
    // Call species service
    // Format response for MCP
  }
}
```

### 5.2 Tool Categories to Implement

1. **Species Tools** (8 tools)
   - search_species
   - get_species
   - match_species
   - suggest_species
   - get_vernacular_names
   - get_synonyms
   - get_children
   - get_parents

2. **Occurrence Tools** (5 tools)
   - search_occurrences
   - get_occurrence
   - count_occurrences
   - download_occurrences
   - facet_search

3. **Registry Tools** (5 tools)
   - search_datasets
   - get_dataset
   - search_organizations
   - get_organization
   - list_networks

4. **Map Tools** (1 tool)
   - generate_map

5. **Literature Tools** (1 tool)
   - search_literature

6. **Vocabulary Tools** (2 tools)
   - list_vocabularies
   - get_concepts

7. **Validator Tools** (2 tools)
   - validate_dwca
   - validate_eml

## Phase 6: Data Transformation (Days 19-20)

### 6.1 Response Formatters

Create formatters for each data type:
- Species → Simplified taxonomic format
- Occurrence → GeoJSON or simplified format
- Dataset → Metadata summary
- Organization → Contact info summary

### 6.2 Pagination Handlers

Implement async generators for large result sets:
```typescript
async function* paginateResults(params) {
  let offset = 0;
  while (true) {
    const results = await fetch({...params, offset});
    yield results;
    if (results.endOfRecords) break;
    offset += limit;
  }
}
```

### 6.3 Error Transformers

Map GBIF errors to user-friendly messages:
- 400 → "Invalid search parameters"
- 404 → "Species/Occurrence not found"
- 429 → "Rate limit exceeded, please wait"
- 500 → "GBIF service temporarily unavailable"

## Phase 7: Testing (Days 21-23)

### 7.1 Unit Tests

Write tests for:
- Each service method
- Tool input validation
- Response formatting
- Error handling

### 7.2 Integration Tests

Test with MSW mocks:
- Full tool execution flow
- Rate limiting behavior
- Cache functionality
- Authentication

### 7.3 End-to-End Tests

Test with real GBIF API (limited):
- Basic search functionality
- Error scenarios
- Pagination

## Phase 8: Documentation (Days 24-25)

### 8.1 User Documentation

Create `docs/USAGE.md`:
- Installation guide
- Configuration options
- Tool descriptions with examples
- Common use cases

### 8.2 API Documentation

Document in `docs/API.md`:
- All available tools
- Input/output schemas
- Error codes
- Rate limits

### 8.3 Example Queries

Create `docs/EXAMPLES.md`:
```
"Find all occurrences of African elephants in Kenya"
"Get taxonomic information for Quercus robur"
"Search for datasets about pollinators"
"Generate a map of bird observations in Europe"
```

## Phase 9: Optimization and Polish (Days 26-28)

### 9.1 Performance Optimization

- Implement connection pooling
- Optimize cache strategies
- Add request deduplication
- Implement batch processing where applicable

### 9.2 Enhanced Features

- Add request correlation IDs
- Implement metrics collection
- Add health check endpoint
- Create diagnostic tools

### 9.3 Security Hardening

- Validate all inputs
- Sanitize error messages
- Implement request signing (if needed)
- Add audit logging

## Phase 10: Deployment and Integration (Days 29-30)

### 10.1 Build and Package

```bash
npm run build
npm run test
npm run package
```

### 10.2 Claude Desktop Integration

1. Build the project
2. Update Claude Desktop config:
```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/path/to/gbif-mcp/build/index.js"]
    }
  }
}
```

### 10.3 Testing in Claude

Test scenarios:
- Species searches
- Occurrence queries
- Complex filters
- Error handling
- Rate limiting

## Implementation Guidelines

### Best Practices

1. **Error Handling**: Always wrap external calls in try-catch
2. **Logging**: Log all API calls with correlation IDs
3. **Validation**: Validate inputs at tool and service layers
4. **Caching**: Cache taxonomy data aggressively (changes rarely)
5. **Rate Limiting**: Respect GBIF's rate limits (100 req/min)
6. **User Agent**: Set custom User-Agent header with contact info
7. **Pagination**: Default to 20 results, max 100
8. **Timeouts**: Set reasonable timeouts (30s for downloads)

### Common Pitfalls to Avoid

1. Not handling GBIF's nested response structures
2. Ignoring pagination for large result sets
3. Not caching taxonomy lookups
4. Missing coordinate precision in occurrence data
5. Not handling GBIF's various date formats
6. Forgetting to handle null/undefined fields

### Performance Targets

- Tool response time: < 2s for simple queries
- Cache hit ratio: > 80% for taxonomy data
- Memory usage: < 512MB under normal load
- Concurrent requests: Support 10 simultaneous users

## Success Criteria

The MCP server is considered complete when:

1. ✅ All high-priority services are implemented
2. ✅ Core tools pass all tests
3. ✅ Documentation is complete
4. ✅ Rate limiting works correctly
5. ✅ Error handling is comprehensive
6. ✅ Cache improves performance by >50%
7. ✅ Successfully integrated with Claude Desktop
8. ✅ Can handle complex biodiversity queries

## Maintenance and Updates

### Regular Tasks

- Monitor GBIF API changes via mailing list
- Update dependencies monthly
- Review error logs for patterns
- Optimize slow queries
- Update documentation with FAQs

### Future Enhancements

- Add more sophisticated NLP for query understanding
- Implement result ranking algorithms
- Add visualization capabilities
- Support bulk operations
- Implement webhook support for long-running downloads
- Add multi-language support for vernacular names

## Resources

- [GBIF API Documentation](https://techdocs.gbif.org/en/openapi/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs)
- [GBIF API Base URL](https://api.gbif.org/v1/)
- [GBIF User Agreement](https://www.gbif.org/terms)
- [Darwin Core Terms](https://dwc.tdwg.org/terms/)

## Contact and Support

- GBIF API Issues: [GBIF GitHub](https://github.com/gbif)
- GBIF Community: [discourse.gbif.org](https://discourse.gbif.org/)
- MCP Support: Project GitHub Issues