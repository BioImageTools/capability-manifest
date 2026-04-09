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

## Canonical Manifests

This repository hosts canonical capability manifests for well-known OME-Zarr viewers in the [`manifests/`](manifests/) directory:

| Manifest | Viewer | OME-Zarr Versions |
| --- | --- | --- |
| [neuroglancer.yaml](manifests/neuroglancer.yaml) | Neuroglancer | 0.4, 0.5 |
| [avivator.yaml](manifests/avivator.yaml) | Avivator (Viv) | 0.4 |
| [validator.yaml](manifests/validator.yaml) | OME-Zarr Validator | 0.4, 0.5 |
| [vole.yaml](manifests/vole.yaml) | Vol-E | 0.4, 0.5 |

Consumers can load these manifests by URL directly from GitHub (raw content URLs) or host copies on their own infrastructure.

Viewer developers are encouraged to maintain their own manifests and submit PRs to update the canonical versions here when capabilities change.

## Manifest Schema (DRAFT)

A capability manifest is a YAML file with two top-level sections: `viewer` and `capabilities`.

### `viewer` Section

Identifies the tool and provides a URL template for launching it.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Human-readable name of the viewer |
| `version` | string | yes | Version of the viewer these capabilities describe |
| `repo` | string | no | URL of the source code repository |
| `template_url` | string | no | URL template for opening a dataset. Use `{DATA_URL}` as a placeholder for the dataset URL — consumers replace it at runtime with the actual OME-Zarr location |

Example:

```yaml
viewer:
  name: "Neuroglancer"
  version: "2.41.2"
  repo: "https://github.com/google/neuroglancer"
  template_url: https://neuroglancer-demo.appspot.com/#!{"layers":[{"name":"image","source":"{DATA_URL}","type":"image"}]}
```

### `capabilities` Section

Describes which OME-Zarr features the tool supports. All fields are optional — omitting a field means the capability is unknown/undeclared.

| Field | Type | Description |
| --- | --- | --- |
| `ome_zarr_versions` | number[] | OME-NGFF specification versions the tool can load (e.g. `[0.4, 0.5]`). When a dataset's multiscales metadata contains a version listed here, the tool should be able to open it. |
| `compression_codecs` | string[] | Compression codecs the tool can decode (e.g. `["blosc", "zstd", "gzip"]`). An empty array `[]` means the tool does not declare codec support — compatibility is unknown rather than unsupported. |
| `rfcs_supported` | number[] | RFC numbers implemented on top of the released OME-NGFF versions. Given test data for a listed RFC, the tool should handle it. |
| `axes` | boolean | Whether axis names and units from the metadata are respected |
| `scale` | boolean | Whether scaling factors on multiscale datasets are respected |
| `translation` | boolean | Whether translation offsets (including subpixel offsets for lower scale levels) are respected |
| `channels` | boolean | Whether the tool supports datasets with multiple channels (c axis) |
| `timepoints` | boolean | Whether the tool supports datasets with multiple timepoints (t axis) |
| `labels` | boolean | Whether pixel-annotation metadata in the "labels" group is loaded |
| `hcs_plates` | boolean | Whether high content screening datasets in the "plate" group are loaded |
| `bioformats2raw_layout` | boolean | Whether the tool can open Zarr stores using the bioformats2raw transitional layout |
| `omero_metadata` | boolean | Whether the tool uses OMERO metadata (e.g. to set default channel colors) |

Example:

```yaml
capabilities:
  ome_zarr_versions: [0.4, 0.5]
  compression_codecs: ["blosc", "zstd", "gzip"]
  rfcs_supported: []
  axes: true
  scale: true
  translation: true
  channels: true
  timepoints: true
  labels: false
  hcs_plates: false
  bioformats2raw_layout: false
  omero_metadata: true
```

### How `validateViewer()` Uses the Manifest

The `validateViewer()` function checks a manifest's declared capabilities against a dataset's `OmeZarrMetadata` and returns a `ValidationResult`:

```typescript
interface ValidationResult {
  compatible: boolean;    // true if no errors (viewer can open the data)
  errors: ValidationError[];   // hard failures — data will not load
  warnings: ValidationWarning[];  // soft issues — data loads but features may be missing
}
```

The checks performed, in order:

| Check | Metadata field | Manifest field | Result if mismatch |
| --- | --- | --- | --- |
| OME-Zarr version | `version` or `multiscales[0].version` | `ome_zarr_versions` | **Error** — viewer cannot load this version |
| Compression codec | `compressor.id` | `compression_codecs` | **Error** if codec not listed; **Warning** if viewer declares no codecs (unknown support) |
| Axes metadata | `axes` | `axes` | **Warning** — axis names/units may be ignored |
| Channel support | `axes` contains c/channel | `channels` | **Error** — multi-channel data won't render |
| Timepoint support | `axes` contains t/time | `timepoints` | **Error** — time-series data won't render |
| Labels | `labels` array non-empty | `labels` | **Warning** — labels won't be displayed |
| HCS plates | `plate` present | `hcs_plates` | **Error** — plate data won't load |
| OMERO metadata | `omero` present | `omero_metadata` | **Warning** — channel colors etc. won't be applied |

A viewer is considered **compatible** (`compatible: true`) when there are zero errors. Warnings indicate features that may be missing but don't prevent the data from loading.

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
