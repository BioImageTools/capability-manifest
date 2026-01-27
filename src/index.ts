/**
 * Capability Manifest Library
 *
 * Main entry point for determining OME-Zarr viewer compatibility.
 *
 * Usage:
 *   import { initializeViewerManifests, getCompatibleViewers } from '@bioimagetools/capability-manifest';
 *
 *   // At application startup
 *   await initializeViewerManifests();
 *
 *   // For each dataset
 *   const viewers = getCompatibleViewers(metadata);
 */

import { loadViewerManifests } from './loader.js';
import { validateViewer, isCompatible } from './validator.js';
import type { ViewerManifest, OmeZarrMetadata, ValidationResult } from './types.js';

// Cache loaded manifests after initialization
let cachedManifests: ViewerManifest[] | null = null;

/**
 * Initialize the library by loading all viewer manifests.
 * Must be called once at application startup before using getCompatibleViewers.
 *
 * @throws Error if manifest loading fails completely
 */
export async function initializeViewerManifests(): Promise<void> {
  cachedManifests = await loadViewerManifests();

  if (cachedManifests.length === 0) {
    throw new Error(
      '[capability-manifest] Failed to load any viewer manifests. Check network and manifest URLs.'
    );
  }
}

/**
 * Get list of viewer names compatible with the given OME-Zarr metadata.
 *
 * @param metadata - Pre-parsed OME-Zarr metadata (from ome-zarr.js or similar)
 * @returns Array of viewer names (e.g., ['Avivator', 'Neuroglancer'])
 * @throws Error if library not initialized
 */
export function getCompatibleViewers(metadata: OmeZarrMetadata): string[] {
  if (!cachedManifests) {
    throw new Error(
      '[capability-manifest] Library not initialized. Call initializeViewerManifests() before using getCompatibleViewers().'
    );
  }

  return cachedManifests
    .filter(viewer => isCompatible(viewer, metadata))
    .map(viewer => viewer.viewer.name);
}

/**
 * Get detailed compatibility information including validation errors and warnings.
 * Useful for debugging or displaying why certain viewers are incompatible.
 *
 * @param metadata - Pre-parsed OME-Zarr metadata
 * @returns Array of objects with viewer name and full validation results
 * @throws Error if library not initialized
 */
export function getCompatibleViewersWithDetails(
  metadata: OmeZarrMetadata
): Array<{ name: string; validation: ValidationResult }> {
  if (!cachedManifests) {
    throw new Error(
      '[capability-manifest] Library not initialized. Call initializeViewerManifests() before using getCompatibleViewersWithDetails().'
    );
  }

  return cachedManifests
    .filter(viewer => isCompatible(viewer, metadata))
    .map(viewer => ({
      name: viewer.viewer.name,
      validation: validateViewer(viewer, metadata)
    }));
}

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
