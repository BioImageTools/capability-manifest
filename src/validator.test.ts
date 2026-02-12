import { describe, it, expect } from 'vitest';
import { validateViewer, isCompatible } from './validator.js';
import type { ViewerManifest, OmeZarrMetadata } from './types.js';

// Helper to create a minimal viewer manifest
function createViewer(capabilities: Partial<ViewerManifest['capabilities']> = {}): ViewerManifest {
  return {
    viewer: {
      name: 'TestViewer',
      version: '1.0.0'
    },
    capabilities: {
      ome_zarr_versions: [0.4],
      compression_codecs: ['blosc', 'gzip', 'zlib'],
      axes: true,
      scale: true,
      translation: true,
      channels: true,
      timepoints: true,
      labels: true,
      hcs_plates: true,
      omero_metadata: true,
      ...capabilities
    }
  };
}

// Helper to create minimal OME-Zarr metadata
function createMetadata(overrides: Partial<OmeZarrMetadata> = {}): OmeZarrMetadata {
  return {
    version: '0.4',
    axes: [
      { name: 'z', type: 'space' },
      { name: 'y', type: 'space' },
      { name: 'x', type: 'space' }
    ],
    ...overrides
  };
}

describe('validateViewer', () => {
  describe('version compatibility', () => {
    it('returns compatible when viewer supports the data version', () => {
      const viewer = createViewer({ ome_zarr_versions: [0.4, 0.5] });
      const metadata = createMetadata({ version: '0.4' });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error when viewer does not support the data version', () => {
      const viewer = createViewer({ ome_zarr_versions: [0.4] });
      const metadata = createMetadata({ version: '0.5' });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].capability).toBe('ome_zarr_versions');
      expect(result.errors[0].required).toBe(0.5);
      expect(result.errors[0].found).toEqual([0.4]);
    });

    it('extracts version from multiscales when not at root level', () => {
      const viewer = createViewer({ ome_zarr_versions: [0.4] });
      const metadata = createMetadata({
        version: undefined,
        multiscales: [{ version: '0.4', datasets: [] }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error when viewer has empty ome_zarr_versions array', () => {
      const viewer = createViewer({ ome_zarr_versions: [] });
      const metadata = createMetadata({ version: '0.4' });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('does not specify OME-Zarr version support');
    });

    it('returns error when viewer has undefined ome_zarr_versions', () => {
      const viewer = createViewer({ ome_zarr_versions: undefined });
      const metadata = createMetadata({ version: '0.4' });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('does not specify OME-Zarr version support');
    });

    it('returns error when metadata has no version', () => {
      const viewer = createViewer({ ome_zarr_versions: [0.4] });
      const metadata = createMetadata({ version: undefined, multiscales: undefined });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].capability).toBe('ome_zarr_versions');
      expect(result.errors[0].message).toContain('Metadata does not specify an OME-Zarr version');
    });
  });

  describe('compression codecs', () => {
    it('returns compatible when viewer supports the codec', () => {
      const viewer = createViewer({ compression_codecs: ['blosc', 'gzip'] });
      const metadata = createMetadata({ compressor: { id: 'blosc' } });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });

    it('returns error when viewer does not support the codec', () => {
      const viewer = createViewer({ compression_codecs: ['blosc', 'gzip'] });
      const metadata = createMetadata({ compressor: { id: 'zstd' } });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].capability).toBe('compression_codecs');
      expect(result.errors[0].required).toBe('zstd');
    });

    it('handles compressor as plain string', () => {
      const viewer = createViewer({ compression_codecs: ['blosc'] });
      const metadata = createMetadata({ compressor: 'zstd' });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors[0].required).toBe('zstd');
    });

    it('skips codec check when metadata has no compressor', () => {
      const viewer = createViewer({ compression_codecs: ['blosc'] });
      const metadata = createMetadata({ compressor: undefined });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });

    it('returns warning when viewer has no codec list but data uses compression', () => {
      const viewer = createViewer({ compression_codecs: undefined });
      const metadata = createMetadata({ compressor: { id: 'zstd' } });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].capability).toBe('compression_codecs');
      expect(result.warnings[0].message).toContain('zstd');
      expect(result.warnings[0].message).toContain('compatibility unknown');
    });
  });

  describe('axes support', () => {
    it('returns warning when data has axes but viewer does not support them', () => {
      const viewer = createViewer({ axes: false });
      const metadata = createMetadata({
        axes: [{ name: 'x', type: 'space' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].capability).toBe('axes');
    });

    it('no warning when viewer supports axes', () => {
      const viewer = createViewer({ axes: true });
      const metadata = createMetadata({
        axes: [{ name: 'x', type: 'space' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.warnings.filter(w => w.capability === 'axes')).toHaveLength(0);
    });
  });

  describe('channels support', () => {
    it('returns error when data has channels but viewer does not support them', () => {
      const viewer = createViewer({ channels: false });
      const metadata = createMetadata({
        axes: [
          { name: 'c', type: 'channel' },
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].capability).toBe('channels');
    });

    it('detects channels by axis name "c"', () => {
      const viewer = createViewer({ channels: false });
      const metadata = createMetadata({
        axes: [{ name: 'c' }, { name: 'y' }, { name: 'x' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.errors.some(e => e.capability === 'channels')).toBe(true);
    });

    it('detects channels by axis type "channel"', () => {
      const viewer = createViewer({ channels: false });
      const metadata = createMetadata({
        axes: [{ name: 'ch', type: 'channel' }, { name: 'y' }, { name: 'x' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.errors.some(e => e.capability === 'channels')).toBe(true);
    });

    it('returns compatible when viewer supports channels', () => {
      const viewer = createViewer({ channels: true });
      const metadata = createMetadata({
        axes: [{ name: 'c', type: 'channel' }, { name: 'y' }, { name: 'x' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });
  });

  describe('timepoints support', () => {
    it('returns error when data has timepoints but viewer does not support them', () => {
      const viewer = createViewer({ timepoints: false });
      const metadata = createMetadata({
        axes: [
          { name: 't', type: 'time' },
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].capability).toBe('timepoints');
    });

    it('detects timepoints by axis name "t"', () => {
      const viewer = createViewer({ timepoints: false });
      const metadata = createMetadata({
        axes: [{ name: 't' }, { name: 'y' }, { name: 'x' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.errors.some(e => e.capability === 'timepoints')).toBe(true);
    });

    it('detects timepoints by axis type "time"', () => {
      const viewer = createViewer({ timepoints: false });
      const metadata = createMetadata({
        axes: [{ name: 'time', type: 'time' }, { name: 'y' }, { name: 'x' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.errors.some(e => e.capability === 'timepoints')).toBe(true);
    });

    it('returns compatible when viewer supports timepoints', () => {
      const viewer = createViewer({ timepoints: true });
      const metadata = createMetadata({
        axes: [{ name: 't', type: 'time' }, { name: 'y' }, { name: 'x' }]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });
  });

  describe('labels support', () => {
    it('returns warning when data has labels but viewer does not support them', () => {
      const viewer = createViewer({ labels: false });
      const metadata = createMetadata({
        labels: ['nuclei', 'cells']
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ capability: 'labels' })
      );
    });

    it('returns compatible when viewer supports labels', () => {
      const viewer = createViewer({ labels: true });
      const metadata = createMetadata({
        labels: ['nuclei', 'cells']
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });

    it('skips label check when metadata has empty labels array', () => {
      const viewer = createViewer({ labels: false });
      const metadata = createMetadata({
        labels: []
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });

    it('skips label check when metadata has no labels', () => {
      const viewer = createViewer({ labels: false });
      const metadata = createMetadata({
        labels: undefined
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });
  });

  describe('HCS plates support', () => {
    it('returns error when data is HCS plate but viewer does not support them', () => {
      const viewer = createViewer({ hcs_plates: false });
      const metadata = createMetadata({
        plate: { wells: [], columns: [] }
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].capability).toBe('hcs_plates');
    });

    it('returns compatible when viewer supports HCS plates', () => {
      const viewer = createViewer({ hcs_plates: true });
      const metadata = createMetadata({
        plate: { wells: [], columns: [] }
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });

    it('skips HCS check when metadata has no plate', () => {
      const viewer = createViewer({ hcs_plates: false });
      const metadata = createMetadata({
        plate: undefined
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
    });
  });

  describe('OMERO metadata support', () => {
    it('returns warning when data has OMERO metadata but viewer does not support it', () => {
      const viewer = createViewer({ omero_metadata: false });
      const metadata = createMetadata({
        omero: { name: 'test-image' }
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].capability).toBe('omero_metadata');
    });

    it('no warning when viewer supports OMERO metadata', () => {
      const viewer = createViewer({ omero_metadata: true });
      const metadata = createMetadata({
        omero: { name: 'test-image' }
      });

      const result = validateViewer(viewer, metadata);

      expect(result.warnings.filter(w => w.capability === 'omero_metadata')).toHaveLength(0);
    });
  });

  describe('multiple validation issues', () => {
    it('collects multiple errors', () => {
      const viewer = createViewer({
        ome_zarr_versions: [0.4],
        channels: false,
        timepoints: false
      });
      const metadata = createMetadata({
        version: '0.5',
        axes: [
          { name: 'c', type: 'channel' },
          { name: 't', type: 'time' },
          { name: 'y', type: 'space' },
          { name: 'x', type: 'space' }
        ]
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('collects both errors and warnings', () => {
      const viewer = createViewer({
        channels: false,
        axes: false,
        omero_metadata: false
      });
      const metadata = createMetadata({
        axes: [{ name: 'c', type: 'channel' }, { name: 'y' }, { name: 'x' }],
        omero: { name: 'test' }
      });

      const result = validateViewer(viewer, metadata);

      expect(result.compatible).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('isCompatible', () => {
  it('returns true when validation has no errors', () => {
    const viewer = createViewer();
    const metadata = createMetadata();

    const result = isCompatible(viewer, metadata);

    expect(result).toBe(true);
  });

  it('returns false when validation has errors', () => {
    const viewer = createViewer({ ome_zarr_versions: [0.4] });
    const metadata = createMetadata({ version: '0.5' });

    const result = isCompatible(viewer, metadata);

    expect(result).toBe(false);
  });

  it('returns true even when there are warnings', () => {
    const viewer = createViewer({ omero_metadata: false });
    const metadata = createMetadata({ omero: { name: 'test' } });

    const result = isCompatible(viewer, metadata);

    expect(result).toBe(true);
  });
});
