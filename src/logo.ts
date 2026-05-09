import type { ViewerManifest } from './types.js';

/**
 * Default base URL for viewer icons hosted in the capability-manifest repository.
 */
const DEFAULT_ICONS_BASE_URL =
  'https://raw.githubusercontent.com/bioimagetools/capability-manifest/host-manifests-and-docs/public/icons';

/**
 * Derive a logo URL for a viewer.
 *
 * If the manifest includes a `viewer.logo` field, that value is returned as-is
 * (allowing per-viewer overrides). Otherwise a URL is constructed pointing to
 * the capability-manifest icon repository, where the filename is the viewer
 * name lowercased with spaces replaced by hyphens
 * (e.g. "OME-Zarr Validator" → "ome-zarr-validator.png").
 *
 * @param manifest - The viewer's capability manifest
 * @returns URL string pointing to the viewer's logo
 */
export function getLogoUrl(manifest: ViewerManifest): string {
  if (manifest.viewer.logo) {
    return manifest.viewer.logo;
  }
  const slug = manifest.viewer.name.toLowerCase().replace(/\s+/g, '-');
  return `${DEFAULT_ICONS_BASE_URL}/${slug}.png`;
}
