# Features

## Comprehensive Tool Suite

### 59 Production-Ready Tools

**Species & Taxonomy (14 tools)**
- Comprehensive species search and identification
- Name matching and standardization
- Taxonomic relationships and hierarchy
- Batch name parsing (up to 1000 names)
- Quick species metrics

**Occurrence Data (14 tools)**
- 2.4B+ occurrence records
- Spatial/temporal filtering
- Complete statistics suite (7 breakdown endpoints)
- Large dataset downloads
- Verbatim data access

**Metadata & Discovery (18 tools)**
- 100,000+ dataset search
- Organization and publisher info
- GRSciColl integration (collections, institutions)
- Network and collaboration data
- GBIF governance (nodes)

**Visualization (4 tools)**
- Map tile generation
- Vector and raster formats
- Custom styling
- Filter-based maps

**Research Impact (2 tools)**
- 10,000+ publication tracking
- Citation search and retrieval

**Standards & Validation (6 tools)**
- Controlled vocabularies
- Data validation (CSV, DwC-A)
- Quality assurance

## Production Quality

### Reliability

✅ **Circuit Breaker Pattern**
- Prevents cascading failures
- Auto-recovery after timeout
- Three states: CLOSED → OPEN → HALF_OPEN

✅ **Retry Logic**
- Exponential backoff
- Configurable retry attempts
- Handles transient failures

✅ **Rate Limiting**
- Respects GBIF API limits
- Client-side enforcement
- Queue management

### Performance

✅ **LRU Caching**
- Configurable size (default: 100MB)
- TTL-based expiration
- Hit/miss statistics

✅ **Request Queueing**
- Concurrency control
- Prevents overwhelming API
- Fair request distribution

✅ **Optimized Endpoints**
- Use count endpoints when possible
- Pagination support throughout
- Efficient data structures

### Testing

✅ **261 unit tests, 32 protocol tests, 59-tool live adversarial matrix (all passing)**
- Core infrastructure: 92% coverage
- Services: 75% coverage
- Tools: 85% coverage

✅ **Comprehensive Test Suite**
- Unit tests for all components
- Service integration tests
- Tool validation tests
- Error scenario coverage

## Developer Experience

### Type Safety

✅ **TypeScript Throughout**
- Strict mode enabled
- Comprehensive type definitions
- IDE autocomplete support

### Validation

✅ **Zod Schema Validation**
- Input validation for all tools
- Type coercion and defaults
- Detailed error messages

### Documentation

✅ **Comprehensive Parameter Docs**
- 2-3 sentence descriptions
- Real-world examples
- Valid ranges and formats
- Links to GBIF documentation

## Capabilities

### What You Can Do

**Species Research:**
- Identify species from names
- Explore taxonomic relationships
- Standardize name spellings
- Get species distribution data

**Occurrence Analysis:**
- Query observations/specimens
- Filter by location/time/quality
- Generate statistics and trends
- Analyze geographic patterns

**Dataset Management:**
- Discover relevant datasets
- Understand data sources
- Validate before publishing
- Track institutional contributions

**Visualization:**
- Generate occurrence maps
- Create custom tile layers
- Filter visualizations
- Multiple color schemes

**Research Tracking:**
- Find papers using GBIF data
- Track data citations
- Measure research impact

## Technical Features

### Architecture

```
MCP Transport (stdio)
    ↓
Protocol Handler
    ↓
Tool Orchestrator
    ↓
Service Layer (with caching, retry, circuit breaker)
    ↓
GBIF Client (rate limiting, queueing)
    ↓
GBIF API
```

### Error Handling

- User-friendly error messages
- HTTP status code transformation
- Detailed logging
- Graceful degradation

### Monitoring

- Request/success/error counts
- Uptime tracking
- Cache statistics
- Circuit breaker state

## Next Steps

- [Install the server](installation.md)
- [Quick start guide](quick-start.md)
- [Explore all tools](../user-guide/overview.md)
