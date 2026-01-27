/**
 * Registry of supported OME-Zarr viewers and their capability manifest locations.
 *
 * CURRENT: Points to local manifests in this repo for proof-of-concept.
 * TODO: In production, point to GitHub repos and assume manifest is at:
 *       {repo_url}/capability-manifest.yaml
 *
 * Example future entry:
 * {
 *   name: 'vizarr',
 *   manifestUrl: 'https://raw.githubusercontent.com/hms-dbmi/viv/main/capability-manifest.yaml'
 * }
 */

const MANIFEST_BASE_URL =
  "https://raw.githubusercontent.com/BioImageTools/capability-manifest/main/public/viewers/";

export const VIEWER_REGISTRY = [
  { name: 'vizarr', manifestUrl: `${MANIFEST_BASE_URL}vizarr.yaml` },
  { name: 'neuroglancer', manifestUrl: `${MANIFEST_BASE_URL}neuroglancer.yaml` },
  { name: 'n5-ij', manifestUrl: `${MANIFEST_BASE_URL}n5-ij.yaml` }
] as const;

export type ViewerRegistryEntry = typeof VIEWER_REGISTRY[number];
