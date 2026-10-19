import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup.js';
import { GBIFClient } from '../../../src/core/gbif-client.js';
import { OccurrenceService } from '../../../src/services/occurrence/occurrence.service.js';

describe('OccurrenceService', () => {
  let client: GBIFClient;
  let service: OccurrenceService;

  beforeEach(() => {
    client = new GBIFClient();
    service = new OccurrenceService(client);
  });

  describe('search', () => {
    it('should search for occurrences', async () => {
      const mockResponse = {
        offset: 0,
        limit: 20,
        endOfRecords: false,
        count: 1000,
        results: [
          {
            key: 123456789,
            scientificName: 'Panthera leo',
            decimalLatitude: -1.5,
            decimalLongitude: 36.5,
            country: 'KE',
            year: 2020,
            basisOfRecord: 'HUMAN_OBSERVATION',
          },
        ],
      };

      server.use(
        http.get('http://localhost:3000/occurrence/search', () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await service.search({ taxonKey: 5231190, limit: 20 });

      expect(result).toEqual(mockResponse);
      expect(result.results).toHaveLength(1);
      expect(result.results?.[0].scientificName).toBe('Panthera leo');
    });

    it('should handle empty search results', async () => {
      server.use(
        http.get('http://localhost:3000/occurrence/search', () => {
          return HttpResponse.json({
            offset: 0,
            limit: 20,
            endOfRecords: true,
            count: 0,
            results: [],
          });
        })
      );

      const result = await service.search({ taxonKey: 999999 });

      expect(result.count).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should handle API errors', async () => {
      server.use(
        http.get('http://localhost:3000/occurrence/search', () => {
          return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        })
      );

      await expect(service.search({ taxonKey: 1 })).rejects.toThrow();
    }, 15000);

    it('should warn about large offset', async () => {
      const mockResponse = {
        offset: 100000,
        limit: 20,
        endOfRecords: false,
        count: 200000,
        results: [],
      };

      server.use(
        http.get('http://localhost:3000/occurrence/search', () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await service.search({ offset: 100000, limit: 20 });
      expect(result.offset).toBe(100000);
    });
  });

  describe('getByKey', () => {
    it('should get occurrence by key', async () => {
      const mockOccurrence = {
        key: 123456789,
        scientificName: 'Panthera leo',
        decimalLatitude: -1.5,
        decimalLongitude: 36.5,
        country: 'KE',
        year: 2020,
        basisOfRecord: 'HUMAN_OBSERVATION',
        recordedBy: 'Jane Doe',
      };

      server.use(
        http.get('http://localhost:3000/occurrence/123456789', () => {
          return HttpResponse.json(mockOccurrence);
        })
      );

      const result = await service.getByKey(123456789);

      expect(result).toEqual(mockOccurrence);
      expect(result.scientificName).toBe('Panthera leo');
    });

    it('should handle not found error', async () => {
      server.use(
        http.get('http://localhost:3000/occurrence/999999999', () => {
          return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
        })
      );

      await expect(service.getByKey(999999999)).rejects.toThrow();
    });
  });

  describe('count', () => {
    it('should return occurrence count', async () => {
      server.use(
        http.get('http://localhost:3000/occurrence/count', () => {
          return HttpResponse.json(1500);
        })
      );

      const count = await service.count({ taxonKey: 5231190, country: 'US' });

      expect(count).toBe(1500);
    });

    it('should handle count errors', async () => {
      server.use(
        http.get('http://localhost:3000/occurrence/count', () => {
          return HttpResponse.json({ error: 'Bad Request' }, { status: 400 });
        })
      );

      await expect(service.count({ taxonKey: 1 })).rejects.toThrow();
    });
  });

  describe('getVerbatim', () => {
    it('should get verbatim occurrence data', async () => {
      const mockVerbatim = {
        key: 123456789,
        'http://rs.tdwg.org/dwc/terms/scientificName': 'Panthera leo',
        'http://rs.tdwg.org/dwc/terms/decimalLatitude': '-1.5',
        'http://rs.tdwg.org/dwc/terms/decimalLongitude': '36.5',
      };

      server.use(
        http.get('http://localhost:3000/occurrence/123456789/verbatim', () => {
          return HttpResponse.json(mockVerbatim);
        })
      );

      const result = await service.getVerbatim(123456789);

      expect(result).toEqual(mockVerbatim);
      expect(result.key).toBe(123456789);
    });
  });

  describe('getDownloadStatus', () => {
    it('should get download status', async () => {
      const mockStatus = {
        key: 'download-123',
        status: 'SUCCEEDED',
        downloadLink: 'https://api.gbif.org/v1/occurrence/download/download-123.zip',
        size: 1024000,
      };

      server.use(
        http.get('http://localhost:3000/occurrence/download/download-123', () => {
          return HttpResponse.json(mockStatus);
        })
      );

      const result = await service.getDownloadStatus('download-123');

      expect(result).toEqual(mockStatus);
      expect(result.status).toBe('SUCCEEDED');
    });

    it('should validate download key', async () => {
      await expect(service.getDownloadStatus('')).rejects.toThrow('Download key is required');
    });
  });

  describe('listUserDownloads', () => {
    it('should list a user\'s downloads with paging and a comma-separated status filter', async () => {
      let url: URL | null = null;
      server.use(
        http.get('http://localhost:3000/occurrence/download/user/jsmith', ({ request }) => {
          url = new URL(request.url);
          return HttpResponse.json({ offset: 5, limit: 10, endOfRecords: true, count: 1, results: [{ key: 'dl-1' }] });
        })
      );

      const result = await service.listUserDownloads(' jsmith ', { offset: 5, limit: 10, status: ['SUCCEEDED', 'RUNNING'] });

      expect(result.results?.[0].key).toBe('dl-1');
      expect(url!.searchParams.get('offset')).toBe('5');
      expect(url!.searchParams.get('limit')).toBe('10');
      expect(url!.searchParams.get('status')).toBe('SUCCEEDED,RUNNING');
    });

    it('should omit the status filter when none is given', async () => {
      let url: URL | null = null;
      server.use(
        http.get('http://localhost:3000/occurrence/download/user/jsmith', ({ request }) => {
          url = new URL(request.url);
          return HttpResponse.json({ results: [] });
        })
      );

      await service.listUserDownloads('jsmith');

      expect(url!.searchParams.has('status')).toBe(false);
      expect(url!.searchParams.get('limit')).toBe('20');
    });

    it('should report a 401 for another user\'s list', async () => {
      server.use(
        http.get('http://localhost:3000/occurrence/download/user/other', () => {
          return new HttpResponse('Unauthorized', { status: 401 });
        })
      );

      await expect(service.listUserDownloads('other')).rejects.toThrow('401');
    });

    it('should validate username', async () => {
      await expect(service.listUserDownloads('  ')).rejects.toThrow('Username is required');
    });
  });

  describe('facet counts', () => {
    it('should derive counts-by-field from a faceted occurrence search honouring filters', async () => {
      let url: URL | null = null;
      server.use(
        http.get('http://localhost:3000/occurrence/search', ({ request }) => {
          url = new URL(request.url);
          return HttpResponse.json({
            offset: 0, limit: 0, endOfRecords: true, count: 3,
            results: [],
            facets: [{ field: 'BASIS_OF_RECORD', counts: [
              { name: 'HUMAN_OBSERVATION', count: 2 },
              { name: 'PRESERVED_SPECIMEN', count: 1 },
            ] }],
          });
        })
      );

      const counts = await service.getCountsByBasisOfRecord({ taxonKey: 2435099, country: 'US' });
      expect(counts).toEqual({ HUMAN_OBSERVATION: 2, PRESERVED_SPECIMEN: 1 });
      expect(url!.searchParams.get('facet')).toBe('basisOfRecord');
      expect(url!.searchParams.get('limit')).toBe('0');
      expect(url!.searchParams.get('taxonKey')).toBe('2435099');
      expect(url!.searchParams.get('country')).toBe('US');
    });

    it('should return an empty map when the search has no facets', async () => {
      server.use(
        http.get('http://localhost:3000/occurrence/search', () => {
          return HttpResponse.json({ offset: 0, limit: 0, endOfRecords: true, count: 0, results: [] });
        })
      );
      expect(await service.getCountsByYear({ taxonKey: 1 })).toEqual({});
    });
  });
});
