import yaml from 'js-yaml';
import { VIEWER_REGISTRY } from './registry.js';
import type { ViewerManifest } from './types.js';

/**
 * Loads all viewer manifests from the registry.
 * Uses Promise.allSettled to handle partial failures gracefully.
 *
 * @returns Array of successfully loaded viewer manifests
 */
export async function loadViewerManifests(): Promise<ViewerManifest[]> {
  const results = await Promise.allSettled(
    VIEWER_REGISTRY.map(async (viewer) => {
      const response = await fetch(viewer.manifestUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${viewer.name} manifest: ${response.status} ${response.statusText}`
        );
      }
      const text = await response.text();
      const manifest = yaml.load(text) as ViewerManifest;
      return manifest;
    })
  );

  // Extract successful results
  const manifests = results
    .filter((r): r is PromiseFulfilledResult<ViewerManifest> => r.status === 'fulfilled')
    .map(r => r.value);

  // Log warnings for failures but don't crash
  const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
  if (failures.length > 0) {
    console.warn(
      `[capability-manifest] Failed to load ${failures.length} viewer manifest(s):`
    );
    failures.forEach(f => console.warn(`  - ${f.reason}`));
  }

  return manifests;
}
