# OME-NGFF Capability Manifests

During the **2025 OME-NGFF Workflows Hackathon**, participants discussed the potential need for a way to programmatically determine OME-NGFF tool capabilities. This repo is a place to experiment with schemas for capability manifests for OME-Zarr-compatible tools.

## Background

Current OME-NGFF (i.e. OME-Zarr) tools tend to support different aspects of the specification. Image viewers are purpose built and may only support a subset of possible data features. At the highest level, the specification is still rapidly evolving and any given tool may only support data up to a certain data version (including RFCs). Even when a tool supports a given OME-NGFF version, the specification is complex enough that tool developers may forgo implementing certain aspects of the specification, especially when those aspects are not aligned with the viewer use cases (e.g. an EM-oriented tool may not implement support for HCS plates). 

## Manifest Specification

TBD

See the [example.yaml](example.yaml) for a conceptual draft of what something like this might look like.

## Other links
* [OME-NGFF specification](https://ngff.openmicroscopy.org)
* [OME-NGFF viewer feature matrix](https://ome.github.io/ome-ngff-tools/)
