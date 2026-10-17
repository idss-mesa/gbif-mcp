#!/usr/bin/env node

/**
 * GBIF MCP Server - Main Entry Point
 *
 * Production-ready MCP server that provides programmatic access to GBIF API
 * with comprehensive error handling, correlation tracking, and monitoring.
 *
 * Speaks MCP protocol revision 2026-07-28 (stateless requests, `server/discover`,
 * cacheable `tools/list`) via the v2 TypeScript SDK, and keeps serving 2025-era
 * clients that still open with the `initialize` handshake.
 */

import {
  McpServer,
  fromJsonSchema,
  type CallToolResult,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/server/validators/ajv';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { GBIFClient } from './core/gbif-client.js';
import { ToolRegistry } from './core/tool-registry.js';
import { RequestHandler } from './protocol/request-handler.js';
import { MCPError, MCPErrorCode, MCPErrorFormatter } from './protocol/mcp-errors.js';

// Import services
import { SpeciesService } from './services/species/species.service.js';
import { OccurrenceService } from './services/occurrence/occurrence.service.js';
import { RegistryService } from './services/registry/registry.service.js';
import { MapsService } from './services/maps/maps.service.js';
import { LiteratureService } from './services/literature/literature.service.js';
import { VocabulariesService } from './services/vocabularies/vocabularies.service.js';
import { ValidatorService } from './services/validator/validator.service.js';

// Import species tools
import {
  SpeciesSearchTool,
  SpeciesGetTool,
  SpeciesSuggestTool,
  SpeciesMatchTool,
  SpeciesVernacularNamesTool,
  SpeciesSynonymsTool,
  SpeciesChildrenTool,
  SpeciesParentsTool,
  SpeciesDescriptionsTool,
  SpeciesDistributionsTool,
  SpeciesMediaTool,
  SpeciesMetricsTool,
  SpeciesParseNamesTool,
  SpeciesRelatedTool,
} from './tools/species/index.js';

// Import occurrence tools
import {
  OccurrenceSearchTool,
  OccurrenceGetTool,
  OccurrenceCountTool,
  OccurrenceDownloadTool,
  OccurrenceDownloadPredicateBuilderTool,
  OccurrenceDownloadStatusTool,
  OccurrenceVerbatimTool,
  OccurrenceCountsByBasisOfRecordTool,
  OccurrenceCountsByYearTool,
  OccurrenceCountsByCountryTool,
  OccurrenceCountsByPublishingCountryTool,
  OccurrenceCountsByDatasetTool,
  OccurrenceCountsByTaxonTool,
  OccurrenceCountsByPublishingOrgTool,
} from './tools/occurrence/index.js';

// Import registry tools
import {
  RegistrySearchDatasetsTool,
  RegistryGetDatasetTool,
  RegistryDatasetMetricsTool,
  RegistryDatasetDocumentTool,
  RegistrySearchOrganizationsTool,
  RegistryGetOrganizationTool,
  RegistryOrganizationDatasetsTool,
  RegistrySearchNetworksTool,
  RegistryGetNetworkTool,
  RegistryNetworkDatasetsTool,
  RegistrySearchInstallationsTool,
  RegistryGetInstallationTool,
  RegistrySearchCollectionsTool,
  RegistryGetCollectionTool,
  RegistrySearchInstitutionsTool,
  RegistryGetInstitutionTool,
  RegistryListNodesTool,
  RegistryGetNodeTool,
} from './tools/registry/index.js';

// Import maps tools
import {
  MapsGetTileUrlTool,
  MapsGetVectorTileUrlTool,
  MapsGetRasterTileUrlTool,
  MapsListStylesTool,
} from './tools/maps/index.js';

// Import literature tools
import {
  LiteratureSearchTool,
  LiteratureGetTool,
} from './tools/literature/index.js';

// Import vocabularies tools
import {
  VocabulariesListTool,
  VocabulariesGetTool,
  VocabulariesGetConceptTool,
} from './tools/vocabularies/index.js';

// Import validator tools
import {
  ValidatorValidateDwcaTool,
  ValidatorGetStatusTool,
  ValidatorValidateTabularTool,
} from './tools/validator/index.js';

/**
 * Server statistics for monitoring
 */
interface ServerStats {
  startTime: Date;
  requestCount: number;
  successCount: number;
  errorCount: number;
  toolExecutions: Map<string, number>;
}

/**
 * Main GBIF MCP Server
 */
class GBIFMCPServer {
  private client: GBIFClient;
  private toolRegistry: ToolRegistry;
  private readonly schemaValidator = new AjvJsonSchemaValidator();
  private stdioHandle?: StdioServerHandle;
  private stats: ServerStats;
  private isShuttingDown = false;

  constructor() {
    // Initialize statistics
    this.stats = {
      startTime: new Date(),
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      toolExecutions: new Map(),
    };

    // Initialize GBIF client
    this.client = new GBIFClient();

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();

    // Setup server components
    this.initializeServices();
    this.setupErrorHandlers();

    logger.info('GBIF MCP Server initialized', {
      version: config.server.version,
      tools: this.toolRegistry.getAll().length,
    });
  }

  /**
   * Initialize all services and register tools
   */
  private initializeServices(): void {
    try {
      // Create service instances
      const speciesService = new SpeciesService(this.client);
      const occurrenceService = new OccurrenceService(this.client);
      const registryService = new RegistryService(this.client);
      const mapsService = new MapsService(this.client);
      const literatureService = new LiteratureService(this.client);
      const vocabulariesService = new VocabulariesService(this.client);
      const validatorService = new ValidatorService(this.client);

      // Register all species tools
      this.toolRegistry.register(new SpeciesSearchTool(speciesService));
      this.toolRegistry.register(new SpeciesGetTool(speciesService));
      this.toolRegistry.register(new SpeciesSuggestTool(speciesService));
      this.toolRegistry.register(new SpeciesMatchTool(speciesService));
      this.toolRegistry.register(new SpeciesVernacularNamesTool(speciesService));
      this.toolRegistry.register(new SpeciesSynonymsTool(speciesService));
      this.toolRegistry.register(new SpeciesChildrenTool(speciesService));
      this.toolRegistry.register(new SpeciesParentsTool(speciesService));
      this.toolRegistry.register(new SpeciesDescriptionsTool(speciesService));
      this.toolRegistry.register(new SpeciesDistributionsTool(speciesService));
      this.toolRegistry.register(new SpeciesMediaTool(speciesService));
      this.toolRegistry.register(new SpeciesMetricsTool(speciesService));
      this.toolRegistry.register(new SpeciesParseNamesTool(speciesService));
      this.toolRegistry.register(new SpeciesRelatedTool(speciesService));

      // Register all occurrence tools
      this.toolRegistry.register(new OccurrenceSearchTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceGetTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceDownloadTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceDownloadPredicateBuilderTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceDownloadStatusTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceVerbatimTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountsByBasisOfRecordTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountsByYearTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountsByCountryTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountsByPublishingCountryTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountsByDatasetTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountsByTaxonTool(occurrenceService));
      this.toolRegistry.register(new OccurrenceCountsByPublishingOrgTool(occurrenceService));

      // Register all registry tools
      this.toolRegistry.register(new RegistrySearchDatasetsTool(registryService));
      this.toolRegistry.register(new RegistryGetDatasetTool(registryService));
      this.toolRegistry.register(new RegistryDatasetMetricsTool(registryService));
      this.toolRegistry.register(new RegistryDatasetDocumentTool(registryService));
      this.toolRegistry.register(new RegistrySearchOrganizationsTool(registryService));
      this.toolRegistry.register(new RegistryGetOrganizationTool(registryService));
      this.toolRegistry.register(new RegistryOrganizationDatasetsTool(registryService));
      this.toolRegistry.register(new RegistrySearchNetworksTool(registryService));
      this.toolRegistry.register(new RegistryGetNetworkTool(registryService));
      this.toolRegistry.register(new RegistryNetworkDatasetsTool(registryService));
      this.toolRegistry.register(new RegistrySearchInstallationsTool(registryService));
      this.toolRegistry.register(new RegistryGetInstallationTool(registryService));
      this.toolRegistry.register(new RegistrySearchCollectionsTool(registryService));
      this.toolRegistry.register(new RegistryGetCollectionTool(registryService));
      this.toolRegistry.register(new RegistrySearchInstitutionsTool(registryService));
      this.toolRegistry.register(new RegistryGetInstitutionTool(registryService));
      this.toolRegistry.register(new RegistryListNodesTool(registryService));
      this.toolRegistry.register(new RegistryGetNodeTool(registryService));

      // Register all maps tools
      this.toolRegistry.register(new MapsGetTileUrlTool(mapsService));
      this.toolRegistry.register(new MapsGetVectorTileUrlTool(mapsService));
      this.toolRegistry.register(new MapsGetRasterTileUrlTool(mapsService));
      this.toolRegistry.register(new MapsListStylesTool(mapsService));

      // Register all literature tools
      this.toolRegistry.register(new LiteratureSearchTool(literatureService));
      this.toolRegistry.register(new LiteratureGetTool(literatureService));

      // Register all vocabularies tools
      this.toolRegistry.register(new VocabulariesListTool(vocabulariesService));
      this.toolRegistry.register(new VocabulariesGetTool(vocabulariesService));
      this.toolRegistry.register(new VocabulariesGetConceptTool(vocabulariesService));

      // Register all validator tools
      this.toolRegistry.register(new ValidatorValidateDwcaTool(validatorService));
      this.toolRegistry.register(new ValidatorGetStatusTool(validatorService));
      this.toolRegistry.register(new ValidatorValidateTabularTool(validatorService));

      const tools = this.toolRegistry.getAll();
      logger.info('Services initialized successfully', {
        toolCount: tools.length,
        speciesTools: 14,
        occurrenceTools: 14,
        registryTools: 17,
        mapsTools: 4,
        literatureTools: 2,
        vocabulariesTools: 3,
        validatorTools: 3,
        tools: tools.map(t => t.getDefinition().name),
      });
    } catch (error) {
      logger.error('Failed to initialize services', { error });
      throw new MCPError(
        MCPErrorCode.INTERNAL_ERROR,
        'Failed to initialize services',
        { error }
      );
    }
  }

  /**
   * Build a fresh MCP server instance exposing every registered tool.
   *
   * The stdio entry (`serveStdio`) calls this factory once per connection after the
   * opening message has selected the protocol era, so a single tool set serves both
   * 2026-07-28 clients and 2025-era clients.
   */
  createMcpServer(): McpServer {
    const mcpServer = new McpServer(
      {
        name: config.server.name,
        version: config.server.version,
        title: 'GBIF Biodiversity Data',
        websiteUrl: 'https://github.com/tyson-swetnam/gbif-mcp',
      },
      {
        capabilities: {
          tools: {},
          // Resources and prompts can be added here in future phases
        },
        instructions: [
          'Tools for querying the Global Biodiversity Information Facility (GBIF) API:',
          'species (taxonomy), occurrences, registry (datasets/organizations/collections),',
          'maps, literature, vocabularies and data validation.',
          'Results are paginated with `offset`/`limit` and an `endOfRecords` flag;',
          'large responses are truncated to the configured size limit with guidance on how to page.',
          'Only download requests need GBIF credentials.',
        ].join(' '),
        // The tool catalogue is static for the lifetime of the process.
        cacheHints: {
          'tools/list': { ttlMs: 60 * 60 * 1000, cacheScope: 'public' },
        },
      }
    );

    for (const tool of this.toolRegistry.getAll()) {
      const definition = tool.getDefinition();
      mcpServer.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: fromJsonSchema<Record<string, unknown>>(
            definition.inputSchema as JsonSchemaType,
            this.schemaValidator
          ),
          annotations: definition.annotations,
        },
        async (args) => this.handleToolCall(definition.name, args)
      );
    }

    mcpServer.server.onerror = (error) => {
      logger.error('MCP Server error', {
        error: error.message,
        name: error.name,
        stack: error.stack,
      });
      this.stats.errorCount++;
    };

    logger.info('Protocol handlers configured', {
      tools: this.toolRegistry.getAll().length,
    });

    return mcpServer;
  }

  /**
   * Execute a tool call with correlation tracking, statistics and error formatting.
   */
  private handleToolCall(name: string, args: Record<string, unknown> | undefined): Promise<CallToolResult> {
    return RequestHandler.withContext(
      'CallTool',
      async (context): Promise<CallToolResult> => {
        this.stats.requestCount++;

        // Update tool execution count
        const currentCount = this.stats.toolExecutions.get(name) || 0;
        this.stats.toolExecutions.set(name, currentCount + 1);

        logger.info('Tool invocation started', {
          correlationId: context.correlationId,
          tool: name,
          hasArgs: !!args,
        });

        try {
          // Check if tool exists
          const tool = this.toolRegistry.get(name);
          if (!tool) {
            throw new MCPError(
              MCPErrorCode.TOOL_NOT_FOUND,
              `Tool not found: ${name}`,
              { availableTools: this.toolRegistry.getAll().map(t => t.getDefinition().name) }
            );
          }

          // Check circuit breaker state
          const circuitState = this.client.getCircuitState();
          if (circuitState === 'OPEN') {
            throw new MCPError(
              MCPErrorCode.CIRCUIT_BREAKER_OPEN,
              'Service temporarily unavailable due to high error rate',
              { circuitState }
            );
          }

          // Execute tool
          const result = await tool.execute(args || {});

          // Final size check before returning
          const resultStr = JSON.stringify(result, null, 2);
          if (resultStr.length > config.responseLimits.maxSizeBytes) {
            logger.error('Tool result exceeds size limit after truncation', {
              correlationId: context.correlationId,
              tool: name,
              size: resultStr.length,
              limit: config.responseLimits.maxSizeBytes
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'Response too large',
                  size: `${Math.round(resultStr.length / 1024)}KB`,
                  limit: `${Math.round(config.responseLimits.maxSizeBytes / 1024)}KB`,
                  suggestion: 'Use smaller limit parameter or add more filters to narrow your search. The response exceeded limits even after automatic truncation.'
                }, null, 2)
              }],
              isError: true,
            };
          }

          this.stats.successCount++;

          logger.info('Tool execution successful', {
            correlationId: context.correlationId,
            tool: name,
            duration: Date.now() - context.startTime,
          });

          return {
            content: [
              {
                type: 'text',
                text: resultStr,
              },
            ],
          };
        } catch (error) {
          this.stats.errorCount++;

          logger.error('Tool execution failed', {
            correlationId: context.correlationId,
            tool: name,
            duration: Date.now() - context.startTime,
            error,
          });

          // Format error response
          return MCPErrorFormatter.formatToolError(error as Error, name);
        }
      },
      { toolName: name }
    );
  }

  /**
   * Setup error handlers for the server
   */
  private setupErrorHandlers(): void {
    // Handle unhandled protocol errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error,
        stack: error.stack,
      });
      if (!this.isShuttingDown) {
        this.shutdown();
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', {
        reason,
        promise,
      });
    });

    logger.info('Error handlers configured');
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Server is shutting down');
    }

    try {
      logger.info('Starting GBIF MCP Server', {
        version: config.server.version,
        tools: this.toolRegistry.getAll().length,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          cacheEnabled: config.features.enableCaching,
          rateLimitEnabled: true,
        },
      });

      // Serve over stdio. The entry owns protocol-era negotiation: a 2026-07-28
      // client (stateless `_meta` envelope / `server/discover`) and a 2025-era
      // client (`initialize` handshake) are both served from the same factory.
      this.stdioHandle = serveStdio(() => this.createMcpServer(), {
        legacy: config.server.legacyClients,
        onerror: (error) => {
          logger.error('MCP stdio transport error', {
            error: error.message,
            name: error.name,
            stack: error.stack,
          });
          this.stats.errorCount++;
        },
      });

      logger.info('GBIF MCP Server started successfully', {
        serverName: config.server.name,
        version: config.server.version,
        transport: 'stdio',
        protocol: {
          latest: '2026-07-28',
          legacyClients: config.server.legacyClients,
        },
        capabilities: {
          tools: this.toolRegistry.getAll().length,
        },
      });

      // Log server statistics periodically (every 5 minutes). The timer is unref'd so it
      // never keeps the process alive once the client has closed the stdio connection.
      if (config.features.enableMetrics) {
        setInterval(() => this.logStatistics(), 5 * 60 * 1000).unref();
      }

      // MCP hosts signal shutdown by closing the server's stdin. Exit promptly (and log
      // final statistics) instead of lingering as an orphaned process.
      process.stdin.once('end', () => {
        logger.info('stdin closed by client, shutting down');
        void this.shutdown();
      });
    } catch (error) {
      logger.error('Failed to start GBIF MCP Server', { error });
      throw error;
    }
  }

  /**
   * Log server statistics
   */
  private logStatistics(): void {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const uptimeMinutes = Math.floor(uptime / 60000);

    logger.info('Server statistics', {
      uptime: `${uptimeMinutes} minutes`,
      requests: {
        total: this.stats.requestCount,
        successful: this.stats.successCount,
        failed: this.stats.errorCount,
        successRate: this.stats.requestCount > 0
          ? ((this.stats.successCount / this.stats.requestCount) * 100).toFixed(2) + '%'
          : '0%',
      },
      topTools: Array.from(this.stats.toolExecutions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      circuitBreaker: {
        state: this.client.getCircuitState(),
      },
      cache: this.client.getCacheStats(),
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    logger.info('Initiating graceful shutdown', {
      finalStats: {
        totalRequests: this.stats.requestCount,
        successCount: this.stats.successCount,
        errorCount: this.stats.errorCount,
        uptime: Date.now() - this.stats.startTime.getTime(),
      },
    });

    try {
      // Log final statistics
      this.logStatistics();

      // Close server connection and stdio transport
      await this.stdioHandle?.close();

      logger.info('GBIF MCP Server shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown', { error });
    } finally {
      // Give logger time to flush
      await new Promise(resolve => setTimeout(resolve, 100));
      process.exit(0);
    }
  }

  /**
   * Get server health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    stats: ServerStats;
    circuitBreaker: string;
  } {
    const circuitState = this.client.getCircuitState();
    const successRate = this.stats.requestCount > 0
      ? this.stats.successCount / this.stats.requestCount
      : 1;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (circuitState === 'OPEN' || successRate < 0.5) {
      status = 'unhealthy';
    } else if (circuitState === 'HALF_OPEN' || successRate < 0.9) {
      status = 'degraded';
    }

    return {
      status,
      uptime: Date.now() - this.stats.startTime.getTime(),
      stats: this.stats,
      circuitBreaker: circuitState,
    };
  }
}

/**
 * Main execution function
 */
async function main() {
  // Create server instance
  const server = new GBIFMCPServer();

  // Setup signal handlers for graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach(signal => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, initiating shutdown`);
      server.shutdown();
    });
  });

  // Start the server
  try {
    await server.start();

    // Health check logging (if metrics enabled); unref'd so it cannot keep the process alive
    if (config.features.enableMetrics) {
      setInterval(() => {
        const health = server.getHealth();
        if (health.status !== 'healthy') {
          logger.warn('Server health degraded', { health });
        }
      }, 60000).unref(); // Check every minute
    }
  } catch (error) {
    logger.error('Fatal error during server startup', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Fatal error in main', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  });
}

// Export for testing
export { GBIFMCPServer };
