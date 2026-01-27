# OME-NGFF Capability Manifests (DRAFT)

During the **2025 OME-NGFF Workflows Hackathon**, participants discussed the potential need for a way to programmatically determine OME-NGFF tool capabilities. This repo is a place to experiment with schemas for capability manifests for OME-Zarr-compatible tools.

## Background

Current OME-NGFF (i.e. OME-Zarr) tools tend to support different aspects of the specification. Image viewers are purpose built and may only support a subset of possible data features. At the highest level, the specification is still rapidly evolving and any given tool may only support data up to a certain data version (including RFCs). Even when a tool supports a given OME-NGFF version, the specification is complex enough that tool developers may forgo implementing certain aspects of the specification, especially when those aspects are not aligned with the viewer use cases (e.g. an EM-oriented tool may not implement support for HCS plates). 

Each tool could optionally publish a "capability manifest" which describes the tool's implementd capabilities with regards to the current and former NGFF Specifications. This manifest could simply live in the tool's Github repo, to be updated whenever relevant changes are made to the code. This manifest can then be interpreted computationally by any platform that wants to launch OME-NGFF tools (OMERO, BFF, Fileglancer, etc.)

## Library Usage

This package can be used as a library to determine which OME-Zarr viewers are compatible with a given dataset.

### Installation

```bash
npm install @bioimagetools/capability-manifest
```

### Usage

```typescript
import {
  initialize,
  getCompatibleViewers,
  type OmeZarrMetadata
} from '@bioimagetools/capability-manifest';

// Initialize once at application startup
await initialize();

// For each dataset, pass pre-parsed metadata
const metadata: OmeZarrMetadata = {
  version: '0.4',
  axes: [
    { name: 'z', type: 'space' },
    { name: 'y', type: 'space' },
    { name: 'x', type: 'space' }
  ],
  // ... other metadata
};

// Get list of compatible viewer names
const viewers = getCompatibleViewers(metadata);
// Returns: ['Avivator', 'Neuroglancer']
```

### API

#### `initialize(): Promise<void>`

Loads all viewer capability manifests. Must be called once at application startup before using other functions.

Throws an error if no manifests can be loaded.

#### `getCompatibleViewers(metadata: OmeZarrMetadata): string[]`

Returns array of viewer names that are compatible with the given dataset metadata.

- **Parameters:**
  - `metadata`: Pre-parsed OME-Zarr metadata object (use ome-zarr.js or similar to parse from Zarr stores)

- **Returns:** Array of viewer names (e.g., `['Avivator', 'Neuroglancer']`)

- **Throws:** Error if library not initialized

#### `getCompatibleViewersWithDetails(metadata: OmeZarrMetadata): Array<{name: string, validation: ValidationResult}>`

Returns detailed compatibility information including validation errors and warnings for each compatible viewer.

Useful for debugging or displaying why certain viewers work/don't work.

### Types

The library exports TypeScript types for all data structures:

- `OmeZarrMetadata` - Structure of OME-Zarr metadata
- `ViewerManifest` - Structure of viewer capability manifests
- `ValidationResult` - Validation outcome with errors/warnings
- `ValidationError`, `ValidationWarning` - Detailed validation messages

## Manifest Specification (DRAFT)

| Attribute | Description |
|------------|-------------|
| ome_zarr_versions | List of OME-NGFF versions which are  supported by the tool. When a Zarr group with multiscales metadata containing a version listed here is given to the tool, the tool promises to do something useful. However, it may not support every feature of the specification. 
| rfcs_supported | List of supported RFC numbers which have been implemented on top of the released OME-NGFF versions listed in ome_zarr_versions. Given test data produced for a given RFC listed here, the tool promises to do something useful. However, it may not support every feature of the RFC. |
| bioformats2raw_layout | A tool that advertises support for this will be able to open a Zarr that implements this transitional layout. |
| omero_metadata | A tool that advertises support for this will be able to open a Zarr that implements this transitional metadata, for example by defaulting channel colors with the provided color values. |
| labels | A tool that advertises support will open pixel-annotation metadata found in the "labels" group. |
| hcs_plates | A tool that advertises support will open high content screening datasets found in the "plate" group. |

## Prototype

There is a [prototype](https://bioimagetools.github.io/capability-manifest/?url=https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0066/ExpD_chicken_embryo_MIP.ome.zarr) in this repo which implements a basic compatibility matrix by fetching the individual viewer manifests. 

## Other links
* [OME-NGFF specifications](https://ngff.openmicroscopy.org)
* [OME-NGFF viewer feature matrix](https://ome.github.io/ome-ngff-tools/)
