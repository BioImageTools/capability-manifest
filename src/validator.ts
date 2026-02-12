import type {
  ViewerManifest,
  OmeZarrMetadata,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './types.js';

/**
 * Validates whether a viewer is compatible with a given OME-Zarr dataset.
 *
 * @param viewer - The viewer manifest to validate
 * @param metadata - The OME-Zarr metadata from the dataset
 * @returns Validation result with compatibility status, errors, and warnings
 */
export function validateViewer(
  viewer: ViewerManifest,
  metadata: OmeZarrMetadata
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check version compatibility - this is critical
  let dataVersion: number | null = null;

  // Try to extract version from metadata (could be in root or in multiscales)
  if (metadata.version) {
    dataVersion = parseFloat(metadata.version);
  } else if (
    metadata.multiscales &&
    metadata.multiscales.length > 0 &&
    metadata.multiscales[0].version
  ) {
    dataVersion = parseFloat(metadata.multiscales[0].version);
  }

  if (dataVersion === null) {
    errors.push({
      capability: 'ome_zarr_versions',
      message: 'Metadata does not specify an OME-Zarr version',
      required: 'version',
      found: null
    });
  } else if (
    !viewer.capabilities.ome_zarr_versions ||
    viewer.capabilities.ome_zarr_versions.length === 0
  ) {
    errors.push({
      capability: 'ome_zarr_versions',
      message: `Viewer does not specify OME-Zarr version support (data is v${dataVersion})`,
      required: dataVersion,
      found: []
    });
  } else if (!viewer.capabilities.ome_zarr_versions.includes(dataVersion)) {
    errors.push({
      capability: 'ome_zarr_versions',
      message: `Viewer does not support OME-Zarr v${dataVersion} (supports: ${viewer.capabilities.ome_zarr_versions.join(', ')})`,
      required: dataVersion,
      found: viewer.capabilities.ome_zarr_versions
    });
  }

  // Check compression codecs
  if (metadata.compressor) {
    const codec = metadata.compressor.id || metadata.compressor;
    if (!viewer.capabilities.compression_codecs) {
      // Viewer doesn't declare codec support - can't guarantee compatibility
      warnings.push({
        capability: 'compression_codecs',
        message: `Data uses codec '${codec}' but viewer doesn't declare codec support - compatibility unknown`
      });
    } else if (!viewer.capabilities.compression_codecs.includes(codec)) {
      errors.push({
        capability: 'compression_codecs',
        message: `Viewer does not support compression codec: ${codec}`,
        required: codec,
        found: viewer.capabilities.compression_codecs
      });
    }
  }

  // Check axes support
  if (metadata.axes && !viewer.capabilities.axes) {
    warnings.push({
      capability: 'axes',
      message: 'Dataset has axis metadata but viewer may not respect it'
    });
  }

  // Check for multiple channels
  const hasChannels = metadata.axes?.some(
    ax => ax.name === 'c' || ax.type === 'channel'
  );
  if (hasChannels && !viewer.capabilities.channels) {
    errors.push({
      capability: 'channels',
      message: 'Dataset has multiple channels but viewer does not support them',
      required: true,
      found: false
    });
  }

  // Check for timepoints
  const hasTime = metadata.axes?.some(ax => ax.name === 't' || ax.type === 'time');
  if (hasTime && !viewer.capabilities.timepoints) {
    errors.push({
      capability: 'timepoints',
      message: 'Dataset has multiple timepoints but viewer does not support them',
      required: true,
      found: false
    });
  }

  // Check for labels
  if (metadata.labels && metadata.labels.length > 0 && !viewer.capabilities.labels) {
    warnings.push({
      capability: 'labels',
      message: 'Dataset has labels but viewer may not display them'
    });
  }

  // Check for HCS plates
  if (metadata.plate && !viewer.capabilities.hcs_plates) {
    errors.push({
      capability: 'hcs_plates',
      message: 'Dataset is an HCS plate but viewer does not support plates',
      required: true,
      found: false
    });
  }

  // Check OMERO metadata
  if (metadata.omero && !viewer.capabilities.omero_metadata) {
    warnings.push({
      capability: 'omero_metadata',
      message: 'Dataset has OMERO metadata but viewer may not use it'
    });
  }

  return {
    compatible: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Helper function to check if a viewer is compatible with metadata.
 * Convenience wrapper around validateViewer that returns only the boolean result.
 *
 * @param viewer - The viewer manifest to check
 * @param metadata - The OME-Zarr metadata from the dataset
 * @returns True if compatible (no errors), false otherwise
 */
export function isCompatible(
  viewer: ViewerManifest,
  metadata: OmeZarrMetadata
): boolean {
  return validateViewer(viewer, metadata).compatible;
}
