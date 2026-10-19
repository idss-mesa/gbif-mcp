import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OccurrenceDownloadListTool,
  describePredicate,
} from '../../../../src/tools/occurrence/occurrence-download-list.tool.js';
import { OccurrenceService } from '../../../../src/services/occurrence/occurrence.service.js';
import { GBIFClient } from '../../../../src/core/gbif-client.js';
import { config } from '../../../../src/config/config.js';

describe('OccurrenceDownloadListTool', () => {
  let tool: OccurrenceDownloadListTool;
  let occurrenceService: OccurrenceService;
  const savedCredentials = { ...config.gbif };

  const mockPage = {
    offset: 0,
    limit: 20,
    endOfRecords: true,
    count: 1,
    results: [
      {
        key: '0035177-260928105237408',
        doi: '10.15468/dl.btz2u9',
        status: 'SUCCEEDED' as const,
        created: '2026-10-19T19:01:34.431+00:00',
        downloadLink: 'https://api.gbif.org/v1/occurrence/download/request/0035177-260928105237408.zip',
        size: 2097152,
        totalRecords: 630,
        numberDatasets: 12,
        eraseAfter: '2027-04-19T19:01:34.197+00:00',
        request: {
          creator: 'testuser',
          format: 'SIMPLE_CSV' as const,
          predicate: {
            type: 'and' as const,
            predicates: [
              { type: 'equals' as const, key: 'TAXON_KEY', value: '5219426' },
              { type: 'equals' as const, key: 'COUNTRY', value: 'US' },
            ],
          },
        },
      },
    ],
  };

  beforeEach(() => {
    (config as any).gbif.username = 'testuser';
    (config as any).gbif.password = 'secret';
    const client = new GBIFClient();
    occurrenceService = new OccurrenceService(client);
    tool = new OccurrenceDownloadListTool(occurrenceService);
  });

  afterEach(() => {
    (config as any).gbif.username = savedCredentials.username;
    (config as any).gbif.password = savedCredentials.password;
  });

  it('should have a read-only tool definition', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBe('gbif_occurrence_download_list');
    expect(definition.description).toContain('downloads');
    expect(definition.annotations?.readOnlyHint).toBe(true);
  });

  it('should default to the configured username and summarize each download', async () => {
    vi.spyOn(occurrenceService, 'listUserDownloads').mockResolvedValue(mockPage);

    const result: any = await tool.execute({});
    expect(occurrenceService.listUserDownloads).toHaveBeenCalledWith('testuser', {
      offset: 0,
      limit: 20,
      status: undefined,
    });
    expect(result.success).toBe(true);
    expect(result.data.count).toBe(1);
    expect(result.data.results[0]).toMatchObject({
      downloadKey: '0035177-260928105237408',
      status: 'SUCCEEDED',
      format: 'SIMPLE_CSV',
      totalRecords: 630,
      size: '2.00 MB',
      filter: 'TAXON_KEY = 5219426 AND COUNTRY = US',
      doi: '10.15468/dl.btz2u9',
      citationUrl: 'https://doi.org/10.15468/dl.btz2u9',
      downloadLink: 'https://api.gbif.org/v1/occurrence/download/request/0035177-260928105237408.zip',
    });
    expect(result.data.results[0].request).toBeUndefined();
    expect(result.metadata.username).toBe('testuser');
  });

  it('should pass username, status and paging through', async () => {
    vi.spyOn(occurrenceService, 'listUserDownloads').mockResolvedValue({ ...mockPage, endOfRecords: false, count: 50 });

    const result: any = await tool.execute({ username: 'other', status: ['RUNNING'], limit: 5, offset: 10 });
    expect(occurrenceService.listUserDownloads).toHaveBeenCalledWith('other', {
      offset: 10,
      limit: 5,
      status: ['RUNNING'],
    });
    expect(result.metadata.nextSteps).toContain('offset 11');
  });

  it('should omit the download link for unfinished downloads', async () => {
    const running = { ...mockPage.results[0], status: 'RUNNING' as const };
    vi.spyOn(occurrenceService, 'listUserDownloads').mockResolvedValue({ ...mockPage, results: [running] });

    const result: any = await tool.execute({});
    expect(result.data.results[0].downloadLink).toBeUndefined();
  });

  it('should require credentials', async () => {
    (config as any).gbif.username = undefined;
    (config as any).gbif.password = undefined;
    const spy = vi.spyOn(occurrenceService, 'listUserDownloads');

    await expect(tool.execute({})).rejects.toThrow('Authentication required');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should explain a 401 from GBIF', async () => {
    vi.spyOn(occurrenceService, 'listUserDownloads').mockRejectedValue(
      new Error('Failed to list downloads for user other: Unauthorized (HTTP 401)')
    );

    await expect(tool.execute({ username: 'other' })).rejects.toThrow('Not authorized');
  });

  it('should reject invalid input', async () => {
    await expect(tool.execute({ status: ['DONE'] })).rejects.toThrow();
    await expect(tool.execute({ limit: 1000 })).rejects.toThrow();
    await expect(tool.execute({ offset: -1 })).rejects.toThrow();
  });
});

describe('describePredicate', () => {
  it('should describe nested and/or/not predicates', () => {
    expect(
      describePredicate({
        type: 'and',
        predicates: [
          { type: 'equals', key: 'COUNTRY', value: 'US' },
          {
            type: 'or',
            predicates: [
              { type: 'greaterThanOrEquals', key: 'YEAR', value: 2000 },
              { type: 'not', predicate: { type: 'isNull', parameter: 'YEAR' } },
            ],
          },
        ],
      })
    ).toBe('COUNTRY = US AND (YEAR >= 2000 OR NOT YEAR IS NULL)');
  });

  it('should shorten long IN lists and geometries', () => {
    expect(describePredicate({ type: 'in', key: 'DATASET_KEY', values: ['a', 'b', 'c', 'd', 'e'] })).toBe(
      'DATASET_KEY IN [a, b, c, +2 more]'
    );
    const wkt = `POLYGON((${'1 1,'.repeat(40)}1 1))`;
    expect(describePredicate({ type: 'within', geometry: wkt })).toMatch(/^WITHIN POLYGON.{50,}…$/);
  });

  it('should return an empty string without a predicate', () => {
    expect(describePredicate(undefined)).toBe('');
  });
});
