import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadViewerManifests } from './loader.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Sample YAML manifests for testing
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
`;

const sampleManifest2Yaml = `
viewer:
  name: AnotherViewer
  version: 2.0.0
capabilities:
  ome_zarr_versions:
    - 0.4
  channels: false
`;

describe('loadViewerManifests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and parses YAML manifests from registry URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleManifestYaml)
    });

    const manifests = await loadViewerManifests();

    expect(manifests.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('returns parsed ViewerManifest objects with correct structure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleManifestYaml)
    });

    const manifests = await loadViewerManifests();

    expect(manifests[0]).toHaveProperty('viewer');
    expect(manifests[0]).toHaveProperty('capabilities');
    expect(manifests[0].viewer).toHaveProperty('name');
    expect(manifests[0].viewer).toHaveProperty('version');
  });

  it('returns empty array and logs warning when all fetches fail', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const manifests = await loadViewerManifests();

    expect(manifests).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns only successful manifests when some fetches fail', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sampleManifestYaml)
        });
      }
      return Promise.reject(new Error('Network error'));
    });

    const manifests = await loadViewerManifests();

    expect(manifests.length).toBe(1);
    expect(manifests[0].viewer.name).toBe('TestViewer');
    expect(console.warn).toHaveBeenCalled();
  });

  it('handles HTTP error responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const manifests = await loadViewerManifests();

    expect(manifests).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it('fetches from all registry URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleManifestYaml)
    });

    await loadViewerManifests();

    // Registry has 3 viewers: vizarr, neuroglancer, n5-ij
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('handles mixed success and failure responses', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sampleManifestYaml)
        });
      } else if (callCount === 2) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        });
      } else {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sampleManifest2Yaml)
        });
      }
    });

    const manifests = await loadViewerManifests();

    expect(manifests.length).toBe(2);
    expect(console.warn).toHaveBeenCalled();
  });

  it('parses capability values correctly from YAML', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleManifestYaml)
    });

    const manifests = await loadViewerManifests();

    expect(manifests[0].capabilities.ome_zarr_versions).toEqual([0.4, 0.5]);
    expect(manifests[0].capabilities.compression_codecs).toEqual(['blosc', 'gzip']);
    expect(manifests[0].capabilities.channels).toBe(true);
    expect(manifests[0].capabilities.timepoints).toBe(true);
  });
});
