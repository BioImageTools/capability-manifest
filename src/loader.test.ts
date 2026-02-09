import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadManifestsFromUrls } from './loader.js';

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

describe('loadManifestsFromUrls', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and parses manifests from provided URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleManifestYaml)
    });

    const urls = ['https://example.com/viewer1.yaml', 'https://example.com/viewer2.yaml'];
    const result = await loadManifestsFromUrls(urls);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/viewer1.yaml');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/viewer2.yaml');
  });

  it('returns Map keyed by URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleManifestYaml)
    });

    const url = 'https://example.com/viewer.yaml';
    const result = await loadManifestsFromUrls([url]);

    expect(result.has(url)).toBe(true);
    const manifest = result.get(url)!;
    expect(manifest.viewer.name).toBe('TestViewer');
    expect(manifest.viewer.version).toBe('1.0.0');
  });

  it('returns parsed ViewerManifest objects with correct structure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleManifestYaml)
    });

    const result = await loadManifestsFromUrls(['https://example.com/viewer.yaml']);
    const manifest = result.values().next().value!;

    expect(manifest).toHaveProperty('viewer');
    expect(manifest).toHaveProperty('capabilities');
    expect(manifest.viewer).toHaveProperty('name');
    expect(manifest.viewer).toHaveProperty('version');
    expect(manifest.capabilities.ome_zarr_versions).toEqual([0.4, 0.5]);
    expect(manifest.capabilities.compression_codecs).toEqual(['blosc', 'gzip']);
    expect(manifest.capabilities.channels).toBe(true);
    expect(manifest.capabilities.timepoints).toBe(true);
  });

  it('returns empty Map and logs warning when all fetches fail', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await loadManifestsFromUrls(['https://example.com/a.yaml', 'https://example.com/b.yaml']);

    expect(result.size).toBe(0);
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

    const urls = ['https://example.com/good.yaml', 'https://example.com/bad.yaml'];
    const result = await loadManifestsFromUrls(urls);

    expect(result.size).toBe(1);
    expect(result.has('https://example.com/good.yaml')).toBe(true);
    expect(result.get('https://example.com/good.yaml')!.viewer.name).toBe('TestViewer');
    expect(console.warn).toHaveBeenCalled();
  });

  it('handles HTTP error responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const result = await loadManifestsFromUrls(['https://example.com/missing.yaml']);

    expect(result.size).toBe(0);
    expect(console.warn).toHaveBeenCalled();
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

    const urls = [
      'https://example.com/a.yaml',
      'https://example.com/b.yaml',
      'https://example.com/c.yaml'
    ];
    const result = await loadManifestsFromUrls(urls);

    expect(result.size).toBe(2);
    expect(result.get('https://example.com/a.yaml')!.viewer.name).toBe('TestViewer');
    expect(result.get('https://example.com/c.yaml')!.viewer.name).toBe('AnotherViewer');
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns empty Map for empty URL array', async () => {
    const result = await loadManifestsFromUrls([]);

    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects manifests missing viewer.name', async () => {
    const invalidYaml = `
viewer:
  version: 1.0.0
capabilities:
  ome_zarr_versions: [0.4]
`;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(invalidYaml)
    });

    const result = await loadManifestsFromUrls(['https://example.com/invalid.yaml']);

    expect(result.size).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('rejects manifests missing viewer.version', async () => {
    const invalidYaml = `
viewer:
  name: TestViewer
capabilities:
  ome_zarr_versions: [0.4]
`;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(invalidYaml)
    });

    const result = await loadManifestsFromUrls(['https://example.com/invalid.yaml']);

    expect(result.size).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('rejects manifests missing capabilities', async () => {
    const invalidYaml = `
viewer:
  name: TestViewer
  version: 1.0.0
`;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(invalidYaml)
    });

    const result = await loadManifestsFromUrls(['https://example.com/invalid.yaml']);

    expect(result.size).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('rejects manifests with non-object capabilities', async () => {
    const invalidYaml = `
viewer:
  name: TestViewer
  version: 1.0.0
capabilities: "not an object"
`;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(invalidYaml)
    });

    const result = await loadManifestsFromUrls(['https://example.com/invalid.yaml']);

    expect(result.size).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('accepts valid manifests alongside invalid ones', async () => {
    const invalidYaml = `
viewer:
  version: 1.0.0
capabilities:
  ome_zarr_versions: [0.4]
`;
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      const thisCall = callCount;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(thisCall === 1 ? sampleManifestYaml : invalidYaml)
      });
    });

    const urls = ['https://example.com/valid.yaml', 'https://example.com/invalid.yaml'];
    const result = await loadManifestsFromUrls(urls);

    expect(result.size).toBe(1);
    expect(result.has('https://example.com/valid.yaml')).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});
