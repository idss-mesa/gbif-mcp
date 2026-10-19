import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import { OccurrenceService } from '../../services/occurrence/occurrence.service.js';
import { config } from '../../config/config.js';
import type { OccurrenceDownload, OccurrenceDownloadStatus } from '../../types/gbif.types.js';

const DOWNLOAD_STATUSES = ['PREPARING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'KILLED', 'SUSPENDED'] as const;

interface DownloadListInput {
  username?: string;
  status?: OccurrenceDownloadStatus[];
  limit?: number;
  offset?: number;
}

const COMPARISON_SYMBOLS: Record<string, string> = {
  equals: '=',
  lessThan: '<',
  lessThanOrEquals: '<=',
  greaterThan: '>',
  greaterThanOrEquals: '>=',
  like: 'LIKE',
};

const MAX_IN_VALUES = 3;
const MAX_FILTER_LENGTH = 300;

/**
 * Render a download predicate as a short, human-readable filter expression,
 * e.g. `TAXON_KEY = 5219426 AND COUNTRY = US`.
 */
export function describePredicate(predicate: any, nested = false): string {
  if (!predicate || typeof predicate !== 'object') return '';

  const { type, key } = predicate;
  let text: string;

  if (type === 'and' || type === 'or') {
    const parts = (predicate.predicates ?? []).map((p: any) => describePredicate(p, true)).filter(Boolean);
    text = parts.join(` ${type.toUpperCase()} `);
    if (nested && parts.length > 1) text = `(${text})`;
  } else if (type === 'not') {
    text = `NOT ${describePredicate(predicate.predicate, true)}`;
  } else if (type in COMPARISON_SYMBOLS) {
    text = `${key} ${COMPARISON_SYMBOLS[type]} ${predicate.value}`;
  } else if (type === 'in') {
    const values: unknown[] = predicate.values ?? [];
    const shown = values.slice(0, MAX_IN_VALUES).join(', ');
    const more = values.length > MAX_IN_VALUES ? `, +${values.length - MAX_IN_VALUES} more` : '';
    text = `${key} IN [${shown}${more}]`;
  } else if (type === 'within') {
    const geometry = String(predicate.geometry ?? '');
    text = `WITHIN ${geometry.length > 60 ? `${geometry.slice(0, 60)}…` : geometry}`;
  } else if (type === 'isNull' || type === 'isNotNull') {
    text = `${predicate.parameter ?? key} IS ${type === 'isNull' ? 'NULL' : 'NOT NULL'}`;
  } else {
    text = JSON.stringify(predicate);
  }

  return !nested && text.length > MAX_FILTER_LENGTH ? `${text.slice(0, MAX_FILTER_LENGTH)}…` : text;
}

/**
 * Tool for listing the authenticated user's occurrence downloads
 */
export class OccurrenceDownloadListTool extends BaseTool<DownloadListInput, any> {
  protected readonly name = 'gbif_occurrence_download_list';
  protected readonly description = 'List your past GBIF occurrence downloads, newest first, so earlier downloads can be found again without their key. Returns each download\'s key, status, creation date, record count, format, a short description of its filters, DOI (for citation) and download link. REQUIRES AUTHENTICATION: GBIF only lists downloads for the account set in GBIF_USERNAME and GBIF_PASSWORD.';

  protected readonly inputSchema = z.object({
    username: z
      .string()
      .min(1)
      .optional()
      .describe('GBIF username whose downloads to list. Defaults to the configured GBIF_USERNAME. GBIF only allows listing the downloads of the account the server is authenticated as.'),
    status: z
      .array(z.enum(DOWNLOAD_STATUSES))
      .optional()
      .describe('Only return downloads in these states. Example: ["SUCCEEDED"] for finished downloads, ["PREPARING", "RUNNING"] for ones still in progress. Default: all states.'),
    limit: z.number().int().min(1).max(100).optional().default(20).describe('Number of downloads to return (1-100). Default: 20.'),
    offset: z.number().int().min(0).optional().default(0).describe('Number of downloads to skip, for paging through older downloads. Default: 0.'),
  });

  private occurrenceService: OccurrenceService;

  constructor(occurrenceService: OccurrenceService) {
    super();
    this.occurrenceService = occurrenceService;
  }

  protected async run(input: DownloadListInput): Promise<any> {
    const username = input.username || config.gbif.username;
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 20;
    if (!username || !config.gbif.password) {
      throw new Error(
        'Authentication required: Please set GBIF_USERNAME and GBIF_PASSWORD environment variables with valid GBIF credentials.'
      );
    }

    let page;
    try {
      page = await this.occurrenceService.listUserDownloads(username, {
        offset,
        limit,
        status: input.status,
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw new Error(
          `Not authorized to list downloads for "${username}": GBIF only lists downloads for the account in GBIF_USERNAME/GBIF_PASSWORD. Check those credentials, or omit username.`
        );
      }
      throw error;
    }

    const results = (page.results ?? []).map((download) => this.summarize(download));
    const nextOffset = offset + results.length;

    return this.formatResponse(
      {
        offset: page.offset ?? offset,
        limit: page.limit ?? limit,
        endOfRecords: page.endOfRecords ?? true,
        count: page.count ?? results.length,
        results,
      },
      {
        username,
        status: input.status,
        nextSteps: page.endOfRecords
          ? 'Use gbif_occurrence_download_status with a downloadKey for full details.'
          : `More downloads available: call again with offset ${nextOffset}. Use gbif_occurrence_download_status with a downloadKey for full details.`,
      }
    );
  }

  private summarize(download: OccurrenceDownload): Record<string, any> {
    return {
      downloadKey: download.key,
      status: download.status,
      created: download.created,
      format: download.request?.format,
      totalRecords: download.totalRecords,
      numberDatasets: download.numberDatasets,
      size: download.size ? `${(download.size / 1024 / 1024).toFixed(2)} MB` : undefined,
      filter: describePredicate(download.request?.predicate) || undefined,
      doi: download.doi,
      citationUrl: download.doi ? `https://doi.org/${download.doi}` : undefined,
      ...(download.status === 'SUCCEEDED' && { downloadLink: download.downloadLink }),
      eraseAfter: download.eraseAfter,
    };
  }
}
