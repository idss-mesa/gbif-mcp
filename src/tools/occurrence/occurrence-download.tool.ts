import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolAnnotations } from '@modelcontextprotocol/server';
import { OccurrenceService } from '../../services/occurrence/occurrence.service.js';
import { config } from '../../config/config.js';
import type { OccurrenceDownloadRequest, DownloadPredicate } from '../../types/gbif.types.js';

/**
 * Tool for requesting large occurrence data downloads (requires authentication)
 */
export class OccurrenceDownloadTool extends BaseTool<any, string> {
  protected readonly name = 'gbif_occurrence_download_request';
  protected readonly description = 'Request an asynchronous download for large occurrence datasets beyond pagination limits (100,000+ records). Returns a download key for checking status. REQUIRES AUTHENTICATION: Set GBIF_USERNAME and GBIF_PASSWORD environment variables.';

  /** Creates a server-side job on GBIF: not read-only, and repeat calls create new jobs. */
  protected readonly annotations: ToolAnnotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  };

  protected readonly inputSchema = z.object({
    creator: z.string().min(1).optional().describe('GBIF username (creator of the download). This is your GBIF.org username. Example: "john.smith". Defaults to the configured GBIF_USERNAME; must match the authenticated account.'),
    notificationAddresses: z
      .array(z.string().email())
      .optional()
      .describe('Email addresses to notify when download completes. Receives notification with download link when processing is finished. Example: ["user@example.com"]. Optional, but highly recommended for large downloads that may take hours to process.'),
    sendNotification: z.boolean().optional().default(true).describe('Send email notification on completion. Set to true (default) to receive email when download is ready, false to skip notifications. Recommended: true for downloads that take more than a few minutes.'),
    format: z
      .enum(['DWCA', 'SIMPLE_CSV', 'SPECIES_LIST'])
      .optional()
      .default('SIMPLE_CSV')
      .describe('Download format. DWCA (Darwin Core Archive) = Full format with metadata and extensions, most comprehensive. SIMPLE_CSV = Simplified CSV format, easier to work with in spreadsheets. SPECIES_LIST = List of unique species only, no occurrence records. Default: SIMPLE_CSV.'),
    predicate: z.any().describe(
      'Download predicate defining filters (REQUIRED). Complex JSON structure specifying which records to include. Use gbif_occurrence_download_predicate_builder tool to construct this from simple search parameters, or build manually following GBIF download API predicate format. Example: {type: "equals", key: "TAXON_KEY", value: "212"} for all bird records.'
    ),
  });

  private occurrenceService: OccurrenceService;

  constructor(occurrenceService: OccurrenceService) {
    super();
    this.occurrenceService = occurrenceService;
  }

  protected async run(input: any): Promise<any> {
    const creator = input.creator || config.gbif.username;
    if (!creator) {
      throw new Error(
        'Authentication required: Please set GBIF_USERNAME and GBIF_PASSWORD environment variables with valid GBIF credentials, or pass creator.'
      );
    }

    try {
      const downloadKey = await this.occurrenceService.requestDownload({ ...input, creator } as OccurrenceDownloadRequest);

      return this.formatResponse(
        {
          downloadKey,
          message: 'Download request submitted successfully. Use gbif_occurrence_download_status to check progress.',
          checkStatusWith: {
            tool: 'gbif_occurrence_download_status',
            input: { downloadKey },
          },
        },
        {
          creator,
          format: input.format,
          willNotify: input.sendNotification && input.notificationAddresses?.length,
        }
      );
    } catch (error: any) {
      // Provide helpful error message for auth issues
      if (error.message?.includes('401') || error.message?.includes('Authentication')) {
        throw new Error(
          'Authentication required: Please set GBIF_USERNAME and GBIF_PASSWORD environment variables with valid GBIF credentials.'
        );
      }
      throw error;
    }
  }
}

/**
 * Helper tool for building download predicates from simple search parameters
 */
export class OccurrenceDownloadPredicateBuilderTool extends BaseTool<any, DownloadPredicate> {
  protected readonly name = 'gbif_occurrence_download_predicate_builder';
  protected readonly description = 'Helper tool to build a download predicate from simple search parameters. Converts occurrence search filters into the complex predicate format required by the download API.';

  protected readonly inputSchema = z.object({
    taxonKey: z.number().optional().describe('GBIF taxon key. A taxon key from the GBIF backbone. All child taxa are included in the download. Example: 212 (for Aves - all birds).'),
    scientificName: z.string().optional().describe('Scientific name from the GBIF backbone. Example: "Panthera leo". All synonyms and child taxa included.'),
    country: z.string().optional().describe('2-letter ISO country code where occurrence was recorded. Example: "US", "BR", "KE".'),
    year: z.string().optional().describe('Year or year range for occurrence date. Example: "2020" (single year), "2015,2020" (range from 2015 to 2020).'),
    hasCoordinate: z.boolean().optional().describe('Filter to records with (true) or without (false) geographic coordinates. Example: true for georeferenced records only.'),
    basisOfRecord: z
      .array(
        z.enum([
          'OBSERVATION',
          'HUMAN_OBSERVATION',
          'MACHINE_OBSERVATION',
          'MATERIAL_SAMPLE',
          'PRESERVED_SPECIMEN',
          'FOSSIL_SPECIMEN',
          'LIVING_SPECIMEN',
          'MATERIAL_CITATION',
          'OCCURRENCE',
        ])
      )
      .optional()
      .describe('Basis of record types to include. Example: ["PRESERVED_SPECIMEN", "FOSSIL_SPECIMEN"] for museum specimens only. Values: OBSERVATION (general), HUMAN_OBSERVATION, MACHINE_OBSERVATION, MATERIAL_SAMPLE, PRESERVED_SPECIMEN, FOSSIL_SPECIMEN, LIVING_SPECIMEN, MATERIAL_CITATION, OCCURRENCE.'),
    datasetKey: z.string().optional().describe('Dataset UUID to limit download to specific dataset. Example: "13b70480-bd69-11dd-b15f-b8a03c50a862".'),
    geometry: z.string().optional().describe('WKT geometry polygon to limit download to geographic area. Polygons must be anticlockwise. Example: "POLYGON ((30.1 10.1, 40 40, 20 40, 10 20, 30.1 10.1))".'),
  });

  private occurrenceService: OccurrenceService;

  constructor(occurrenceService: OccurrenceService) {
    super();
    this.occurrenceService = occurrenceService;
  }

  protected async run(input: any): Promise<any> {
    const predicate = this.occurrenceService.buildPredicateFromSearch(input);

    return this.formatResponse(
      {
        predicate,
        message: 'Use this predicate in gbif_occurrence_download_request',
        example: {
          tool: 'gbif_occurrence_download_request',
          input: {
            creator: 'your-gbif-username',
            format: 'SIMPLE_CSV',
            predicate: predicate,
          },
        },
      },
      { inputFilters: input }
    );
  }
}
