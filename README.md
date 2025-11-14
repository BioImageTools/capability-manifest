# OME-NGFF Capability Manifests

During the **2025 OME-NGFF Workflows Hackathon**, participants discussed the potential need for a way to programmatically determine OME-NGFF tool capabilities. This repo is a place to experiment with schemas for capability manifests for OME-Zarr-compatible tools.

## Background

Current OME-NGFF (i.e. OME-Zarr) tools tend to support different aspects of the specification. Image viewers are purpose built and may only support a subset of possible data features. At the highest level, the specification is still rapidly evolving and any given tool may only support data up to a certain data version (including RFCs). Even when a tool supports a given OME-NGFF version, the specification is complex enough that tool developers may forgo implementing certain aspects of the specification, especially when those aspects are not aligned with the viewer use cases (e.g. an EM-oriented tool may not implement support for HCS plates). 

## Manifest Specification

| Attribute | Description |
|------------|-------------|
| ome_zarr_versions | List of OME-NGFF versions which are  supported by the tool. When a Zarr group with multiscales metadata containing a version listed here is given to the tool, the tool promises to do something useful. However, it may not support every feature of the specification. 
| rfcs_supported | List of supported RFC numbers which have been implemented on top of the released OME-NGFF versions listed in ome_zarr_versions. Given test data produced for a given RFC listed here, the tool promises to do something useful. However, it may not support every feature of the RFC. |
| bioformats2raw_layout | A tool that advertises support for this will be able to open a Zarr that implements this transitional layout. |
| omero_metadata | A tool that advertises support for this will be able to open a Zarr that implements this transitional metadata, for example by defaulting channel colors with the provided color values. |
| labels | A tool that advertises support will open pixel-annotation metadata found in the "labels" group. |
| hcs_plates | A tool that advertises support will open high content screening datasets found in the "plate" group. |


See the [example.yaml](example.yaml) for a conceptual draft of what something like this might look like.

## Other links
* [OME-NGFF specification](https://ngff.openmicroscopy.org)
* [OME-NGFF viewer feature matrix](https://ome.github.io/ome-ngff-tools/)
