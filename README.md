# OME-NGFF Capability Manifests (DRAFT)

During the **2025 OME-NGFF Workflows Hackathon**, participants discussed the potential need for a way to programmatically determine OME-NGFF tool capabilities. This repo is a place to experiment with schemas for capability manifests for OME-Zarr-compatible tools.

## Background

Current OME-NGFF (i.e. OME-Zarr) tools tend to support different aspects of the specification. Image viewers are purpose built and may only support a subset of possible data features. At the highest level, the specification is still rapidly evolving and any given tool may only support data up to a certain data version (including RFCs). Even when a tool supports a given OME-NGFF version, the specification is complex enough that tool developers may forgo implementing certain aspects of the specification, especially when those aspects are not aligned with the viewer use cases (e.g. an EM-oriented tool may not implement support for HCS plates).

Each tool could optionally publish a "capability manifest" which describes the tool's implementd capabilities with regards to the current and former NGFF Specifications. This manifest could simply live in the tool's Github repo, to be updated whenever relevant changes are made to the code. This manifest can then be interpreted computationally by any platform that wants to launch OME-NGFF tools (OMERO, BFF, Fileglancer, etc.)

## Library Usage

This package can be used as a library to determine which OME-Zarr viewers are compatible with a given dataset. The caller provides manifest URLs; the library fetches, parses, and validates them.

### Installation

```bash
npm install @bioimagetools/capability-manifest
```

### Usage

```typescript
import {
  loadManifestsFromUrls,
  getCompatibleViewers,
  type OmeZarrMetadata,
} from "@bioimagetools/capability-manifest";

// Load manifests from URLs you control
const manifestMap = await loadManifestsFromUrls([
  "https://example.com/viewers/neuroglancer.yaml",
  "https://example.com/viewers/avivator.yaml",
]);
const manifests = [...manifestMap.values()];

// For each dataset, pass manifests and pre-parsed metadata
const metadata: OmeZarrMetadata = {
  version: "0.4",
  axes: [
    { name: "z", type: "space" },
    { name: "y", type: "space" },
    { name: "x", type: "space" },
  ],
  // ... other metadata
};

// Get list of compatible viewer names
const viewers = getCompatibleViewers(manifests, metadata);
// Returns: ['Avivator', 'Neuroglancer']
```

### API

#### `loadManifestsFromUrls(manifestUrls: string[]): Promise<Map<string, ViewerManifest>>`

Fetches and parses capability manifest YAML files from the provided URLs.

- **Parameters:**
  - `manifestUrls`: Array of URLs pointing to capability manifest YAML files
- **Returns:** Map keyed by URL to the successfully loaded ViewerManifest
- **Behavior:** Uses `Promise.allSettled` for graceful partial failure. Logs warnings for failed URLs but does not throw. Validates that each manifest has `viewer.name` (string), `viewer.version` (string), and `capabilities` (object).

#### `getCompatibleViewers(manifests: ViewerManifest[], metadata: OmeZarrMetadata): string[]`

Returns array of viewer names that are compatible with the given dataset metadata.

- **Parameters:**
  - `manifests`: Array of viewer manifests to check against
  - `metadata`: Pre-parsed OME-Zarr metadata object (use ome-zarr.js or similar to parse from Zarr stores)
- **Returns:** Array of viewer names (e.g., `['Avivator', 'Neuroglancer']`)

#### `getCompatibleViewersWithDetails(manifests: ViewerManifest[], metadata: OmeZarrMetadata): Array<{name: string, validation: ValidationResult}>`

Returns detailed compatibility information including validation errors and warnings for each compatible viewer. Useful for debugging or displaying why certain viewers work/don't work.

#### `isCompatible(viewer: ViewerManifest, metadata: OmeZarrMetadata): boolean`

Returns whether a single viewer is compatible with the given metadata.

#### `validateViewer(viewer: ViewerManifest, metadata: OmeZarrMetadata): ValidationResult`

Returns full validation details (compatible flag, errors, warnings) for a single viewer against the given metadata.

### Types

The library exports TypeScript types for all data structures:

- `ViewerManifest` - Structure of viewer capability manifests
- `OmeZarrMetadata` - Structure of OME-Zarr metadata
- `ValidationResult` - Validation outcome with errors/warnings
- `ValidationError`, `ValidationWarning` - Detailed validation messages
- `AxisMetadata`, `MultiscaleMetadata` - Nested metadata types

## Manifest Specification (DRAFT)

| Attribute             | Description                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ome_zarr_versions     | List of OME-NGFF versions which are supported by the tool. When a Zarr group with multiscales metadata containing a version listed here is given to the tool, the tool promises to do something useful. However, it may not support every feature of the specification.               |
| rfcs_supported        | List of supported RFC numbers which have been implemented on top of the released OME-NGFF versions listed in ome_zarr_versions. Given test data produced for a given RFC listed here, the tool promises to do something useful. However, it may not support every feature of the RFC. |
| bioformats2raw_layout | A tool that advertises support for this will be able to open a Zarr that implements this transitional layout.                                                                                                                                                                         |
| omero_metadata        | A tool that advertises support for this will be able to open a Zarr that implements this transitional metadata, for example by defaulting channel colors with the provided color values.                                                                                              |
| labels                | A tool that advertises support will open pixel-annotation metadata found in the "labels" group.                                                                                                                                                                                       |
| hcs_plates            | A tool that advertises support will open high content screening datasets found in the "plate" group.                                                                                                                                                                                  |

## Prototype

There is a [prototype](https://bioimagetools.github.io/capability-manifest/?url=https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0066/ExpD_chicken_embryo_MIP.ome.zarr) in this repo which implements a basic compatibility matrix by fetching the individual viewer manifests.

## Releasing to npm

To publish a new version to npm manually:

```bash
# 1. Run tests
npm test

# 2. Clean and build the library (compiles TypeScript to dist/)
rm -rf dist && npm run build:lib

# 3. Bump the version in package.json (patch, minor, or major)
# Using this command automatically makes a commit with the
# updated package.json and package-lock.json
npm version patch   # e.g. 0.3.1 -> 0.3.2

# 4. Login to npm (if not already) and publish
# (uses "publishConfig": {"access": "public"} from package.json)
npm login
npm publish

# 5. Push the version commit
git push
```

## Other links

- [OME-NGFF specifications](https://ngff.openmicroscopy.org)
- [OME-NGFF viewer feature matrix](https://ome.github.io/ome-ngff-tools/)
