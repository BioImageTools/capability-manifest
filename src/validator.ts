import type {
  ViewerManifest,
  OmeZarrMetadata,
  MultiscaleMetadata,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "./types.js";
import { classifyCodec } from "./codecs.js";

function hasTransformationType(
  multiscales: MultiscaleMetadata[],
  type: "scale" | "translation",
): boolean {
  return multiscales.some(
    (ms) =>
      ms.datasets?.some((ds) =>
        ds.coordinateTransformations?.some((ct) => ct.type === type),
      ) || ms.coordinateTransformations?.some((ct) => ct.type === type),
  );
}

/**
 * Validates whether a viewer is compatible with a given OME-Zarr dataset.
 *
 * @param viewer - The viewer manifest to validate
 * @param metadata - The OME-Zarr metadata from the dataset
 * @returns Validation result with compatibility status, errors, and warnings
 */
export function validateViewer(
  viewer: ViewerManifest,
  metadata: OmeZarrMetadata,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check version compatibility - this is critical
  let dataVersion: string | null = null;

  // Try to extract version from metadata (could be in root or in multiscales)
  if (metadata.version) {
    dataVersion = metadata.version;
  } else if (
    metadata.multiscales &&
    metadata.multiscales.length > 0 &&
    metadata.multiscales[0].version
  ) {
    dataVersion = metadata.multiscales[0].version;
  }

  if (dataVersion === null) {
    errors.push({
      capability: "ome_zarr_versions",
      message: "Metadata does not specify an OME-Zarr version",
      required: "version",
      found: null,
    });
  } else if (
    !viewer.capabilities.ome_zarr_versions ||
    viewer.capabilities.ome_zarr_versions.length === 0
  ) {
    errors.push({
      capability: "ome_zarr_versions",
      message: `Viewer does not specify OME-Zarr version support (data is v${dataVersion})`,
      required: dataVersion,
      found: [],
    });
  } else if (
    !viewer.capabilities.ome_zarr_versions.map(String).includes(dataVersion)
  ) {
    errors.push({
      capability: "ome_zarr_versions",
      message: `Viewer does not support OME-Zarr v${dataVersion} (supports: ${viewer.capabilities.ome_zarr_versions.join(", ")})`,
      required: dataVersion,
      found: viewer.capabilities.ome_zarr_versions,
    });
  }

  // Collect the codecs the viewer must be able to decompress. Zarr v2 exposes a
  // single compressor via compressor.id (always an actual compression codec);
  // Zarr v3 exposes an ordered pipeline via codecs[] that also contains
  // serialization codecs, transforms, and checksums, which must NOT be compared
  // against the viewer's compression codec list. See classifyCodec().
  const compressionCodecs: string[] = [];
  const unknownCodecs: string[] = [];
  if (metadata.compressor?.id) {
    compressionCodecs.push(metadata.compressor.id);
  } else if (metadata.codecs) {
    for (const codec of metadata.codecs) {
      switch (classifyCodec(codec.name)) {
        case "compression":
          compressionCodecs.push(codec.name);
          break;
        case "unknown":
          unknownCodecs.push(codec.name);
          break;
        // "structural" codecs are not relevant to compression compatibility.
      }
    }
  }

  if (compressionCodecs.length > 0) {
    if (
      !viewer.capabilities.compression_codecs ||
      viewer.capabilities.compression_codecs.length === 0
    ) {
      // Viewer doesn't declare codec support - can't guarantee compatibility
      const codecList = compressionCodecs.join("', '");
      warnings.push({
        capability: "compression_codecs",
        message: `Data uses codec '${codecList}' but viewer doesn't declare codec support - compatibility unknown`,
      });
    } else {
      for (const codec of compressionCodecs) {
        if (!viewer.capabilities.compression_codecs.includes(codec)) {
          errors.push({
            capability: "compression_codecs",
            message: `Viewer does not support compression codec: ${codec}`,
            required: codec,
            found: viewer.capabilities.compression_codecs,
          });
        }
      }
    }
  }

  // Codecs we cannot classify can be neither confirmed compatible nor ruled
  // incompatible. Warn (rather than error) unless the viewer explicitly lists
  // the codec, so a novel codec never silently hides a viewer or passes as fine.
  for (const codec of unknownCodecs) {
    if (!viewer.capabilities.compression_codecs?.includes(codec)) {
      warnings.push({
        capability: "compression_codecs",
        message: `Data uses unrecognized codec '${codec}' - compatibility unknown`,
      });
    }
  }

  // TODO: Check rfcs_supported (hard compatibility requirement)
  // Blocker: OME-NGFF metadata does not expose which RFCs a dataset requires.
  // After determing how to implement this check, compare metadata.rfcs_required against
  // viewer.capabilities.rfcs_supported and push to errors[] on mismatch.

  // Check axes support
  if (metadata.axes && !viewer.capabilities.axes) {
    warnings.push({
      capability: "axes",
      message: "Dataset has axis metadata but viewer may not respect it",
    });
  }

  // Check support for respecting scaling factors on multiscales
  if (
    metadata.multiscales &&
    hasTransformationType(metadata.multiscales, "scale") &&
    !viewer.capabilities.scale
  ) {
    warnings.push({
      capability: "scale",
      message:
        "Dataset has coordinate scale transformations but viewer may not respect them",
    });
  }

  // Check translation support
  if (
    metadata.multiscales &&
    hasTransformationType(metadata.multiscales, "translation") &&
    !viewer.capabilities.translation
  ) {
    warnings.push({
      capability: "translation",
      message:
        "Dataset has coordinate translation offsets but viewer may not respect them",
    });
  }

  // Check for multiple channels
  const hasChannels = metadata.axes?.some(
    (ax) => ax.name === "c" || ax.type === "channel",
  );
  if (hasChannels && !viewer.capabilities.channels) {
    warnings.push({
      capability: "channels",
      message: "Dataset has multiple channels but viewer may not support them",
    });
  }

  // Check for timepoints
  const hasTime = metadata.axes?.some(
    (ax) => ax.name === "t" || ax.type === "time",
  );
  if (hasTime && !viewer.capabilities.timepoints) {
    warnings.push({
      capability: "timepoints",
      message:
        "Dataset has multiple timepoints but viewer may not support them",
    });
  }

  // Check for labels
  if (
    metadata.labels &&
    metadata.labels.length > 0 &&
    !viewer.capabilities.labels
  ) {
    warnings.push({
      capability: "labels",
      message: "Dataset has labels but viewer may not display them",
    });
  }

  // Check for HCS plates
  if (metadata.plate && !viewer.capabilities.hcs_plates) {
    warnings.push({
      capability: "hcs_plates",
      message: "Dataset is an HCS plate but viewer may not support plates",
    });
  }

  // Check bioformats2raw layout support
  if (
    metadata.bioformats2raw_layout &&
    !viewer.capabilities.bioformats2raw_layout
  ) {
    warnings.push({
      capability: "bioformats2raw_layout",
      message:
        "Dataset uses bioformats2raw layout but viewer may not support it",
    });
  }

  // Check OMERO metadata
  if (metadata.omero && !viewer.capabilities.omero_metadata) {
    warnings.push({
      capability: "omero_metadata",
      message: "Dataset has OMERO metadata but viewer may not use it",
    });
  }

  return {
    dataCompatible: errors.length === 0,
    dataFeaturesSupported: warnings.length === 0,
    errors,
    warnings,
  };
}

/**
 * Helper function to check if a viewer is compatible with metadata.
 * Convenience wrapper around validateViewer that returns only the boolean result.
 *
 * @param viewer - The viewer manifest to check
 * @param metadata - The OME-Zarr metadata from the dataset
 * @returns True if data compatible (no errors), false otherwise
 */
export function isCompatible(
  viewer: ViewerManifest,
  metadata: OmeZarrMetadata,
): boolean {
  return validateViewer(viewer, metadata).dataCompatible;
}
