// Schema types
export type Schema = {
  properties: {
    viewer: {
      properties: {
        [key: string]: PropertyDefinition;
      };
    };
    capabilities: {
      properties: {
        [key: string]: CapabilityDefinition;
      };
    };
  };
};

export interface PropertyDefinition {
  type: string;
  description?: string;
  default?: any;
  format?: string;
  examples?: any[];
}

export interface CapabilityDefinition extends PropertyDefinition {
  items?: any;
  enum?: string[];
}

// Viewer manifest types
export type ViewerManifest = {
  viewer: {
    name: string;
    version: string;
    repo?: string;
    template_url?: string;
  };
  capabilities: {
    ome_zarr_versions?: number[];
    compression_codecs?: string[];
    rfcs_supported?: number[];
    axes?: boolean;
    scale?: boolean;
    translation?: boolean;
    channels?: boolean;
    timepoints?: boolean;
    labels?: boolean;
    hcs_plates?: boolean;
    bioformats2raw_layout?: boolean;
    omero_metadata?: boolean;
  };
};

// OME-Zarr metadata types
export type AxisMetadata = {
  name: string;
  type?: string;
  unit?: string;
};

export type CoordinateTransformation =
  | { type: 'identity' }
  | { type: 'scale'; scale: number[] }
  | { type: 'scale'; path: string }
  | { type: 'translation'; translation: number[] }
  | { type: 'translation'; path: string };

export type DatasetMetadata = {
  path: string;
  coordinateTransformations?: CoordinateTransformation[];
};

export type MultiscaleMetadata = {
  version?: string;
  axes?: AxisMetadata[];
  datasets: DatasetMetadata[];
  coordinateTransformations?: CoordinateTransformation[];
  [key: string]: unknown;
};

export type OmeZarrMetadata = {
  version?: string;
  axes?: AxisMetadata[];
  bioformats2raw_layout?: boolean;
  multiscales?: MultiscaleMetadata[];
  omero?: { [key: string]: unknown };
  labels?: string[];
  plate?: { [key: string]: unknown };
  well?: { [key: string]: unknown };
  compressor?: unknown;
};

// Validation types
export type ValidationResult = {
  /** Can the viewer read and parse this data? Determines whether a viewer is shown.
   * Determined by ome_zarr_versions, compression_codecs, and rfcs_supported.
   */
  dataCompatible: boolean;
  /**
   * Does the viewer support all features in this data? Determines whether
   * warnings are shown/logged, NOT whether the viewer is shown. A viewer may be
   * compatible with a dataset but not support all features
   */
  dataFeaturesSupported: boolean;
  /** Data compatibility errors (e.g. unsupported version or codec) */
  errors: ValidationError[];
  /** Unsupported data feature warnings (e.g. labels, channels not supported) */
  warnings: ValidationWarning[];
};

export type ValidationError = {
  capability: string;
  message: string;
  required: any;
  found: any;
};

export type ValidationWarning = {
  capability: string;
  message: string;
};
