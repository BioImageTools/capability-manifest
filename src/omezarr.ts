/**
 * Canonical OME-Zarr / OME-NGFF metadata types.
 *
 * This module is intentionally dependency-free (no zarrita, no ome-zarr.js)
 * so it stays portable and can be extracted into a standalone shared package
 * later.
 */

export type AxisMetadata = {
  name: string;
  type?: string;
  unit?: string;
};

export type CoordinateTransformation =
  | { type: "identity" }
  | { type: "scale"; scale: number[] }
  | { type: "scale"; path: string }
  | { type: "translation"; translation: number[] }
  | { type: "translation"; path: string };

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

/** Contrast/intensity window for an omero channel. */
export type OmeroWindow = {
  min?: number;
  max?: number;
  start?: number;
  end?: number;
  [key: string]: unknown;
};

/** A single omero rendering channel. */
export type OmeroChannel = {
  label?: string;
  color?: string;
  window?: OmeroWindow;
  [key: string]: unknown;
};

export type OmeroMetadata = {
  channels?: OmeroChannel[];
  [key: string]: unknown;
};

/** High-content-screening plate metadata. */
export type PlateMetadata = {
  columns?: { name: string }[];
  rows?: { name: string }[];
  wells?: { path: string; rowIndex: number; columnIndex: number }[];
  acquisitions?: { id: number; [key: string]: unknown }[];
  field_count?: number;
  name?: string;
  version?: string;
  [key: string]: unknown;
};

export type WellMetadata = {
  images?: { path: string; acquisition?: number }[];
  version?: string;
  [key: string]: unknown;
};

export type OmeZarrMetadata = {
  version?: string;
  axes?: AxisMetadata[];
  bioformats2raw_layout?: boolean;
  multiscales?: MultiscaleMetadata[];
  omero?: OmeroMetadata;
  labels?: string[];
  plate?: PlateMetadata;
  well?: WellMetadata;
  compressor?: { id: string; [key: string]: unknown } | null; // Zarr v2
  codecs?: Array<{ name: string; configuration?: { [key: string]: unknown } }>; // Zarr v3
};
