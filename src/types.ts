// Schema types
export interface Schema {
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
}

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
export interface ViewerManifest {
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
}

// OME-Zarr metadata types
export interface OmeZarrMetadata {
  version?: string;
  axes?: AxisMetadata[];
  multiscales?: MultiscaleMetadata[];
  omero?: any;
  labels?: string[];
  plate?: any;
  compressor?: any;
}

export interface AxisMetadata {
  name: string;
  type?: string;
  unit?: string;
}

export interface MultiscaleMetadata {
  version?: string;
  axes?: AxisMetadata[];
  datasets?: any[];
}

// Validation types
export interface ValidationResult {
  compatible: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  capability: string;
  message: string;
  required: any;
  found: any;
}

export interface ValidationWarning {
  capability: string;
  message: string;
}
