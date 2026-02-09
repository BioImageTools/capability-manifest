import { describe, it, expect } from 'vitest';
import { getCompatibleViewers, getCompatibleViewersWithDetails } from './index.js';
import type { ViewerManifest, OmeZarrMetadata } from './types.js';

// Helper to create a viewer manifest
function createManifest(
  name: string,
  capabilities: Partial<ViewerManifest['capabilities']> = {}
): ViewerManifest {
  return {
    viewer: { name, version: '1.0.0' },
    capabilities: {
      ome_zarr_versions: [0.4, 0.5],
      axes: true,
      scale: true,
      translation: true,
      channels: true,
      timepoints: true,
      labels: false,
      hcs_plates: false,
      omero_metadata: false,
      ...capabilities
    }
  };
}

describe('getCompatibleViewers', () => {
  it('returns names of compatible viewers', () => {
    const manifests = [
      createManifest('ViewerA'),
      createManifest('ViewerB')
    ];
    const metadata: OmeZarrMetadata = {
      version: '0.4',
      axes: [
        { name: 'z', type: 'space' },
        { name: 'y', type: 'space' },
        { name: 'x', type: 'space' }
      ]
    };

    const result = getCompatibleViewers(manifests, metadata);

    expect(result).toEqual(['ViewerA', 'ViewerB']);
  });

  it('filters out incompatible viewers', () => {
    const manifests = [
      createManifest('FullViewer', { ome_zarr_versions: [0.4, 0.5], channels: true }),
      createManifest('LimitedViewer', { ome_zarr_versions: [0.4], channels: false })
    ];
    const metadata: OmeZarrMetadata = {
      version: '0.4',
      axes: [
        { name: 'c', type: 'channel' },
        { name: 'y', type: 'space' },
        { name: 'x', type: 'space' }
      ]
    };

    const result = getCompatibleViewers(manifests, metadata);

    expect(result).toContain('FullViewer');
    expect(result).not.toContain('LimitedViewer');
  });

  it('returns empty array when no viewers are compatible', () => {
    const manifests = [
      createManifest('ViewerA', { ome_zarr_versions: [0.4] })
    ];
    const metadata: OmeZarrMetadata = {
      version: '0.5',
      axes: [
        { name: 'y', type: 'space' },
        { name: 'x', type: 'space' }
      ]
    };

    const result = getCompatibleViewers(manifests, metadata);

    expect(result).toEqual([]);
  });

  it('returns empty array when given empty manifests array', () => {
    const metadata: OmeZarrMetadata = { version: '0.4' };

    const result = getCompatibleViewers([], metadata);

    expect(result).toEqual([]);
  });
});

describe('getCompatibleViewersWithDetails', () => {
  it('returns viewer name and validation details', () => {
    const manifests = [createManifest('TestViewer')];
    const metadata: OmeZarrMetadata = {
      version: '0.4',
      axes: [
        { name: 'z', type: 'space' },
        { name: 'y', type: 'space' },
        { name: 'x', type: 'space' }
      ]
    };

    const results = getCompatibleViewersWithDetails(manifests, metadata);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('TestViewer');
    expect(results[0].validation).toHaveProperty('compatible');
    expect(results[0].validation).toHaveProperty('errors');
    expect(results[0].validation).toHaveProperty('warnings');
  });

  it('only returns compatible viewers', () => {
    const manifests = [
      createManifest('Compatible', { ome_zarr_versions: [0.4] }),
      createManifest('Incompatible', { ome_zarr_versions: [0.5] })
    ];
    const metadata: OmeZarrMetadata = { version: '0.4' };

    const results = getCompatibleViewersWithDetails(manifests, metadata);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Compatible');
    expect(results[0].validation.compatible).toBe(true);
    expect(results[0].validation.errors).toHaveLength(0);
  });

  it('includes warnings in validation details', () => {
    const manifests = [
      createManifest('PartialViewer', {
        ome_zarr_versions: [0.4],
        axes: false,
        omero_metadata: false
      })
    ];
    const metadata: OmeZarrMetadata = {
      version: '0.4',
      axes: [
        { name: 'y', type: 'space' },
        { name: 'x', type: 'space' }
      ],
      omero: { name: 'test' }
    };

    const results = getCompatibleViewersWithDetails(manifests, metadata);

    expect(results).toHaveLength(1);
    expect(results[0].validation.compatible).toBe(true);
    expect(results[0].validation.warnings.length).toBeGreaterThan(0);
  });

  it('returns empty array when given empty manifests array', () => {
    const metadata: OmeZarrMetadata = { version: '0.4' };

    const results = getCompatibleViewersWithDetails([], metadata);

    expect(results).toEqual([]);
  });
});
