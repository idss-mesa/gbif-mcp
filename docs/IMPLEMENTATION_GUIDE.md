# GBIF MCP Server Implementation Guide

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm or yarn package manager
- GBIF account (optional, for authenticated endpoints)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/idss-mesa/gbif-mcp.git
cd gbif-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build the project:
```bash
npm run build
```

5. Run the server:
```bash
npm start
```

## Development

### Project Structure

```
gbif-mcp/
├── src/
│   ├── config/           # Configuration management
│   ├── core/             # Core infrastructure (client, registry)
│   ├── services/         # GBIF API service implementations
│   │   ├── species/      # Species API service
│   │   ├── occurrence/   # Occurrence API service
│   │   ├── registry/     # Registry API service
│   │   ├── maps/         # Maps API service
│   │   ├── literature/   # Literature API service
│   │   ├── vocabularies/ # Vocabularies API service
│   │   └── validator/    # Validator API service
│   ├── tools/            # MCP tool implementations
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   └── index.ts          # Main entry point
├── tests/                # Test files
├── docs/                 # Documentation
└── build/                # Compiled output

```

### Adding New Tools

1. Create a new tool class extending `BaseTool`:

```typescript
import { z } from 'zod';
import { BaseTool } from '../base-tool.js';

export class MyNewTool extends BaseTool<InputType, OutputType> {
  protected readonly name = 'gbif_my_new_tool';
  protected readonly description = 'Description of what this tool does';

  protected readonly inputSchema = z.object({
    // Define input parameters
  });

  constructor(private service: MyService) {
    super();
  }

  protected async run(input: InputType): Promise<OutputType> {
    // Implement tool logic
    return await this.service.doSomething(input);
  }
}
```

2. Register the tool in `index.ts`:

```typescript
const myService = new MyService(this.client);
this.toolRegistry.register(new MyNewTool(myService));
```

### Error Handling

The server implements a multi-layer error handling strategy:

1. **Transport Layer**: Handles connection and protocol errors
2. **Tool Layer**: Validates inputs and transforms errors
3. **Service Layer**: Handles business logic errors
4. **Client Layer**: Manages HTTP errors and retries

Example error handling:

```typescript
try {
  const result = await this.service.getData(params);
  return this.formatResponse(result);
} catch (error) {
  if (error.statusCode === 404) {
    throw new Error('Resource not found in GBIF');
  }
  throw this.transformError(error);
}
```

### Rate Limiting

The server implements automatic rate limiting:

- **Default**: 100 requests per minute
- **Concurrent requests**: 10 max
- **Backoff**: Exponential with 2x multiplier
- **Max backoff**: 60 seconds

Customize in `.env`:
```env
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_CONCURRENT=20
```

### Caching

Response caching is enabled by default:

- **Cache size**: 100MB
- **TTL**: 1 hour
- **Strategy**: LRU (Least Recently Used)

Disable or configure in `.env`:
```env
CACHE_ENABLED=false
CACHE_MAX_SIZE=200
CACHE_TTL=7200000
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- species.service.test.ts

# Watch mode
npm test -- --watch
```

### Writing Tests

Example unit test:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SpeciesService } from '../../src/services/species/species.service.js';

describe('SpeciesService', () => {
  let service: SpeciesService;

  beforeEach(() => {
    service = new SpeciesService(mockClient);
  });

  it('should search for species', async () => {
    const result = await service.search({ q: 'Puma' });
    expect(result.results).toBeDefined();
  });
});
```

## MCP Tool Reference

### Species Tools

#### gbif_species_search
Search for species in the GBIF backbone taxonomy.

**Parameters:**
- `q`: Search query string
- `rank`: Taxonomic rank filter
- `status`: Taxonomic status filter
- `limit`: Number of results (max 1000)
- `offset`: Pagination offset

**Example:**
```json
{
  "q": "Panthera",
  "rank": "GENUS",
  "limit": 10
}
```

#### gbif_species_get
Get detailed information about a species.

**Parameters:**
- `key`: GBIF species key

**Example:**
```json
{
  "key": 5231190
}
```

#### gbif_species_suggest
Get species name suggestions for autocomplete.

**Parameters:**
- `q`: Partial species name
- `limit`: Maximum suggestions

**Example:**
```json
{
  "q": "Pan",
  "limit": 5
}
```

#### gbif_species_match
Fuzzy match a species name against the backbone.

**Parameters:**
- `name`: Species name to match
- `strict`: Use strict matching

**Example:**
```json
{
  "name": "Panthera leo",
  "strict": false
}
```

### Occurrence Tools

(To be implemented)

- `gbif_occurrence_search`: Search occurrence records
- `gbif_occurrence_get`: Get occurrence by key
- `gbif_occurrence_count`: Count occurrences
- `gbif_occurrence_download`: Request occurrence download

### Registry Tools

(To be implemented)

- `gbif_dataset_search`: Search datasets
- `gbif_dataset_get`: Get dataset by key
- `gbif_organization_search`: Search organizations
- `gbif_organization_get`: Get organization by key

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY build ./build
CMD ["node", "build/index.js"]
```

### Environment Variables

Required for production:
```env
NODE_ENV=production
LOG_LEVEL=warn
LOG_FORMAT=json
```

Optional authentication:
```env
GBIF_USERNAME=your_username
GBIF_PASSWORD=your_password
```

### Health Monitoring

The server logs metrics that can be monitored:

- Request/response times
- Error rates by type
- Cache hit/miss ratios
- Rate limit encounters

Example log output:
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "context": "ToolExecution",
  "tool": "gbif_species_search",
  "duration": 245,
  "success": true
}
```

## Troubleshooting

### Common Issues

#### Rate Limiting Errors
**Problem**: Getting 429 errors from GBIF API
**Solution**: Reduce concurrent requests or increase backoff time

#### Memory Usage
**Problem**: High memory consumption
**Solution**: Reduce cache size or disable caching

#### Authentication Failures
**Problem**: 401 errors on protected endpoints
**Solution**: Verify GBIF credentials in `.env`

#### Connection Timeouts
**Problem**: Requests timing out
**Solution**: Increase `GBIF_TIMEOUT` value

### Debug Mode

Enable detailed logging:
```env
LOG_LEVEL=debug
LOG_FORMAT=simple
```

### Support

For issues or questions:
1. Check the [Architecture Documentation](./ARCHITECTURE.md)
2. Review test files for usage examples
3. Enable debug logging for detailed traces
4. Submit issues with reproduction steps