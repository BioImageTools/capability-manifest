import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OmeZarrMetadata } from './types.js';

// Sample YAML manifest for testing
const sampleManifestYaml = `
viewer:
  name: TestViewer
  version: 1.0.0
capabilities:
  ome_zarr_versions:
    - 0.4
    - 0.5
  compression_codecs:
    - blosc
    - gzip
  channels: true
  timepoints: true
  labels: true
  hcs_plates: false
`;

const limitedManifestYaml = `
viewer:
  name: LimitedViewer
  version: 1.0.0
capabilities:
  ome_zarr_versions:
    - 0.4
  channels: false
  timepoints: false
`;

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Public API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset the cached manifests by re-importing the module
    // We need to reset module state between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeViewerManifests', () => {
    it('loads manifests from the registry', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleManifestYaml)
      });

      // Dynamically import to get fresh module state
      const { initializeViewerManifests: init } = await import('./index.js');

      await expect(init()).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('throws error when no manifests can be loaded', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { initializeViewerManifests: init } = await import('./index.js');

      await expect(init()).rejects.toThrow('Failed to load any viewer manifests');
    });

    it('throws error when all manifests fail to load', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const { initializeViewerManifests: init } = await import('./index.js');

      await expect(init()).rejects.toThrow('Failed to load any viewer manifests');
    });
  });

  describe('getCompatibleViewers', () => {
    it('throws error when library not initialized', async () => {
      const { getCompatibleViewers: get } = await import('./index.js');

      const metadata: OmeZarrMetadata = { version: '0.4' };

      expect(() => get(metadata)).toThrow('Library not initialized');
    });

    it('returns array of compatible viewer names', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleManifestYaml)
      });

      const { initializeViewerManifests: init, getCompatibleViewers: get } =
        await import('./index.js');

      await init();

      const metadata: OmeZarrMetadata = {
        version: '0.4',
        axes: [
          { name: 'z', type: 'space' },
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      };

      const viewers = get(metadata);

      expect(Array.isArray(viewers)).toBe(true);
      expect(viewers.length).toBeGreaterThan(0);
      expect(typeof viewers[0]).toBe('string');
    });

    it('filters out incompatible viewers', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        const yaml = callCount === 1 ? sampleManifestYaml : limitedManifestYaml;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(yaml)
        });
      });

      const { initializeViewerManifests: init, getCompatibleViewers: get } =
        await import('./index.js');

      await init();

      // Metadata with channels - LimitedViewer doesn't support channels
      const metadata: OmeZarrMetadata = {
        version: '0.4',
        axes: [
          { name: 'c', type: 'channel' },
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      };

      const viewers = get(metadata);

      expect(viewers).toContain('TestViewer');
      expect(viewers).not.toContain('LimitedViewer');
    });

    it('returns empty array when no viewers are compatible', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(limitedManifestYaml)
      });

      const { initializeViewerManifests: init, getCompatibleViewers: get } =
        await import('./index.js');

      await init();

      // Metadata with version 0.5 - LimitedViewer only supports 0.4
      const metadata: OmeZarrMetadata = {
        version: '0.5',
        axes: [
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      };

      const viewers = get(metadata);

      expect(viewers).toEqual([]);
    });
  });

  describe('getCompatibleViewersWithDetails', () => {
    it('throws error when library not initialized', async () => {
      const { getCompatibleViewersWithDetails: get } = await import('./index.js');

      const metadata: OmeZarrMetadata = { version: '0.4' };

      expect(() => get(metadata)).toThrow('Library not initialized');
    });

    it('returns array with viewer name and validation details', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleManifestYaml)
      });

      const { initializeViewerManifests: init, getCompatibleViewersWithDetails: get } =
        await import('./index.js');

      await init();

      const metadata: OmeZarrMetadata = {
        version: '0.4',
        axes: [
          { name: 'z', type: 'space' },
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      };

      const results = get(metadata);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('validation');
      expect(results[0].validation).toHaveProperty('compatible');
      expect(results[0].validation).toHaveProperty('errors');
      expect(results[0].validation).toHaveProperty('warnings');
    });

    it('only returns compatible viewers with their validation details', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleManifestYaml)
      });

      const { initializeViewerManifests: init, getCompatibleViewersWithDetails: get } =
        await import('./index.js');

      await init();

      const metadata: OmeZarrMetadata = {
        version: '0.4',
        axes: [
          { name: 'z', type: 'space' },
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      };

      const results = get(metadata);

      // All returned results should be compatible
      results.forEach((result) => {
        expect(result.validation.compatible).toBe(true);
        expect(result.validation.errors).toHaveLength(0);
      });
    });

    it('includes warnings in validation details', async () => {
      const manifestWithLimitedSupport = `
viewer:
  name: PartialViewer
  version: 1.0.0
capabilities:
  ome_zarr_versions:
    - 0.4
  axes: false
  omero_metadata: false
`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(manifestWithLimitedSupport)
      });

      const { initializeViewerManifests: init, getCompatibleViewersWithDetails: get } =
        await import('./index.js');

      await init();

      const metadata: OmeZarrMetadata = {
        version: '0.4',
        axes: [
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ],
        omero: { name: 'test' }
      };

      const results = get(metadata);

      // Should be compatible but with warnings
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].validation.compatible).toBe(true);
      expect(results[0].validation.warnings.length).toBeGreaterThan(0);
    });
  });
});
