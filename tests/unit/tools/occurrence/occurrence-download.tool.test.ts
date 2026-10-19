import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OccurrenceDownloadTool } from '../../../../src/tools/occurrence/occurrence-download.tool.js';
import { OccurrenceService } from '../../../../src/services/occurrence/occurrence.service.js';
import { GBIFClient } from '../../../../src/core/gbif-client.js';
import { config } from '../../../../src/config/config.js';

describe('OccurrenceDownloadTool', () => {
  let tool: OccurrenceDownloadTool;
  let occurrenceService: OccurrenceService;

  beforeEach(() => {
    const client = new GBIFClient();
    occurrenceService = new OccurrenceService(client);
    tool = new OccurrenceDownloadTool(occurrenceService);
  });

  it('should have correct tool definition', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBe('gbif_occurrence_download_request');
    expect(definition.description).toContain('download');
  });

  it('should execute with valid predicate', async () => {
    vi.spyOn(occurrenceService as any, 'requestDownload').mockResolvedValue('download-123');

    const input = {
      creator: 'testuser',
      predicate: {
        type: 'equals' as const,
        key: 'TAXON_KEY',
        value: '5231190',
      },
    };

    const result: any = await tool.execute(input);
    expect(result.success).toBe(true);
    expect(result.data.downloadKey).toBe('download-123');
  });

  it('should handle AND predicates', async () => {
    vi.spyOn(occurrenceService as any, 'requestDownload').mockResolvedValue('download-456');

    const input = {
      creator: 'testuser',
      predicate: {
        type: 'and' as const,
        predicates: [
          { type: 'equals' as const, key: 'TAXON_KEY', value: '5231190' },
          { type: 'equals' as const, key: 'COUNTRY', value: 'US' },
        ],
      },
    };

    const result: any = await tool.execute(input);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should handle service errors', async () => {
    vi.spyOn(occurrenceService as any, 'requestDownload').mockRejectedValue(
      new Error('Download request failed')
    );

    const input = {
      creator: 'testuser',
      predicate: {
        type: 'equals' as const,
        key: 'TAXON_KEY',
        value: '1',
      },
    };

    await expect(tool.execute(input)).rejects.toThrow();
  });

  describe('creator default', () => {
    const savedUsername = config.gbif.username;
    const predicate = { type: 'equals' as const, key: 'TAXON_KEY', value: '1' };

    afterEach(() => {
      (config as any).gbif.username = savedUsername;
    });

    it('should default creator to the configured GBIF username', async () => {
      (config as any).gbif.username = 'configured-user';
      const spy = vi.spyOn(occurrenceService as any, 'requestDownload').mockResolvedValue('download-789');

      const result: any = await tool.execute({ predicate });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ creator: 'configured-user' }));
      expect(result.metadata.creator).toBe('configured-user');
    });

    it('should prefer an explicit creator', async () => {
      (config as any).gbif.username = 'configured-user';
      const spy = vi.spyOn(occurrenceService as any, 'requestDownload').mockResolvedValue('download-789');

      await tool.execute({ creator: 'explicit-user', predicate });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ creator: 'explicit-user' }));
    });

    it('should fail without a creator or configured username', async () => {
      (config as any).gbif.username = undefined;
      const spy = vi.spyOn(occurrenceService as any, 'requestDownload');

      await expect(tool.execute({ predicate })).rejects.toThrow('Authentication required');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
