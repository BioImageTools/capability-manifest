/**
 * Capability Manifest Library
 *
 * Determines OME-Zarr viewer compatibility based on capability manifests.
 *
 * Usage:
 *   import { loadManifestsFromUrls, getCompatibleViewers } from '@bioimagetools/capability-manifest';
 *
 *   // Load manifests from URLs
 *   const manifests = await loadManifestsFromUrls([...urls]);
 *
 *   // For each dataset
 *   const viewers = getCompatibleViewers([...manifests.values()], metadata);
 */

import { validateViewer, isCompatible } from './validator.js';
import type { ViewerManifest, OmeZarrMetadata, ValidationResult } from './types.js';

/**
 * Get list of viewer names compatible with the given OME-Zarr metadata.
 *
 * @param manifests - Array of viewer manifests to check against
 * @param metadata - Pre-parsed OME-Zarr metadata (from ome-zarr.js or similar)
 * @returns Array of viewer names (e.g., ['Avivator', 'Neuroglancer'])
 */
export function getCompatibleViewers(
  manifests: ViewerManifest[],
  metadata: OmeZarrMetadata
): string[] {
  return manifests
    .filter(viewer => isCompatible(viewer, metadata))
    .map(viewer => viewer.viewer.name);
}

/**
 * Get detailed compatibility information including validation errors and warnings.
 * Useful for debugging or displaying why certain viewers are incompatible.
 *
 * @param manifests - Array of viewer manifests to check against
 * @param metadata - Pre-parsed OME-Zarr metadata
 * @returns Array of objects with viewer name and full validation results
 */
export function getCompatibleViewersWithDetails(
  manifests: ViewerManifest[],
  metadata: OmeZarrMetadata
): Array<{ name: string; validation: ValidationResult }> {
  return manifests
    .filter(viewer => isCompatible(viewer, metadata))
    .map(viewer => ({
      name: viewer.viewer.name,
      validation: validateViewer(viewer, metadata)
    }));
}

// Re-export loader
export { loadManifestsFromUrls } from './loader.js';

// Re-export validator functions
export { validateViewer, isCompatible } from './validator.js';

// Re-export types for consumers
export type {
  ViewerManifest,
  OmeZarrMetadata,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AxisMetadata,
  MultiscaleMetadata
} from './types.js';
