import { describe, it, expect } from 'vitest';
import { getLogoUrl } from './logo.js';
import type { ViewerManifest } from './types.js';

function createManifest(
  name: string,
  logo?: string
): ViewerManifest {
  return {
    viewer: { name, version: '1.0.0', ...(logo !== undefined ? { logo } : {}) },
    capabilities: {
      ome_zarr_versions: [0.4, 0.5]
    }
  };
}

describe('getLogoUrl', () => {
  it('returns the manifest logo field when provided', () => {
    const manifest = createManifest('Neuroglancer', 'https://example.com/custom-logo.png');
    expect(getLogoUrl(manifest)).toBe('https://example.com/custom-logo.png');
  });

  it('derives a URL from the viewer name when no logo field is set', () => {
    const manifest = createManifest('Neuroglancer');
    expect(getLogoUrl(manifest)).toBe(
      'https://raw.githubusercontent.com/bioimagetools/capability-manifest/host-manifests-and-docs/public/icons/neuroglancer.png'
    );
  });

  it('replaces spaces with hyphens in the derived slug', () => {
    const manifest = createManifest('OME-Zarr Validator');
    expect(getLogoUrl(manifest)).toBe(
      'https://raw.githubusercontent.com/bioimagetools/capability-manifest/host-manifests-and-docs/public/icons/ome-zarr-validator.png'
    );
  });

  it('handles multiple consecutive spaces', () => {
    const manifest = createManifest('My  Cool  Viewer');
    expect(getLogoUrl(manifest)).toBe(
      'https://raw.githubusercontent.com/bioimagetools/capability-manifest/host-manifests-and-docs/public/icons/my-cool-viewer.png'
    );
  });

  it('does not use an empty string logo as an override', () => {
    const manifest = createManifest('Avivator', '');
    expect(getLogoUrl(manifest)).toBe(
      'https://raw.githubusercontent.com/bioimagetools/capability-manifest/host-manifests-and-docs/public/icons/avivator.png'
    );
  });
});
