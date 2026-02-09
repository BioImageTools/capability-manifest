import yaml from 'js-yaml';
import type { ViewerManifest } from './types.js';

/**
 * Validates that a parsed object has the minimum required manifest structure.
 */
function isValidManifest(parsed: unknown): parsed is ViewerManifest {
  return (
    typeof parsed === 'object' && parsed !== null &&
    'viewer' in parsed && typeof (parsed as any).viewer?.name === 'string' &&
    typeof (parsed as any).viewer?.version === 'string' &&
    'capabilities' in parsed && typeof (parsed as any).capabilities === 'object'
  );
}

/**
 * Loads viewer manifests from an array of URLs.
 * Uses Promise.allSettled to handle partial failures gracefully.
 *
 * @param manifestUrls - Array of URLs pointing to capability manifest YAML files
 * @returns Map keyed by URL to the successfully loaded ViewerManifest
 */
export async function loadManifestsFromUrls(
  manifestUrls: string[]
): Promise<Map<string, ViewerManifest>> {
  const results = await Promise.allSettled(
    manifestUrls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch manifest from ${url}: ${response.status} ${response.statusText}`
        );
      }
      const text = await response.text();
      const parsed = yaml.load(text);

      if (!isValidManifest(parsed)) {
        throw new Error(
          `Invalid manifest structure from ${url}: must have viewer.name (string), viewer.version (string), and capabilities (object)`
        );
      }

      return { url, manifest: parsed };
    })
  );

  const manifests = new Map<string, ViewerManifest>();

  // Extract successful results
  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<{ url: string; manifest: ViewerManifest }> =>
      r.status === 'fulfilled'
  );
  for (const result of fulfilled) {
    manifests.set(result.value.url, result.value.manifest);
  }

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
