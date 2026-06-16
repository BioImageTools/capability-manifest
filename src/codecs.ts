/**
 * Zarr codec classification, dependency-free so it stays portable alongside the
 * canonical OME-Zarr metadata types in `omezarr.ts`.
 *
 * A Zarr v3 array declares an ordered codec pipeline (`codecs[]`) made up of
 * three transform kinds (per the Zarr v3 spec):
 *   - array_to_array  e.g. transpose
 *   - array_to_bytes  serialization; exactly one required, e.g. bytes,
 *                     sharding_indexed
 *   - bytes_to_bytes  e.g. blosc, gzip, zstd (compression) and crc32c (checksum)
 *
 * Only *compression* codecs determine whether a viewer can read the data: a
 * viewer that cannot decompress the bytes cannot open the dataset. Serialization
 * codecs, transposes, and checksums are not compression and must not be compared
 * against a viewer's declared `compression_codecs` (doing so is the original
 * false-incompatible bug — every v3 array carries a `bytes` serialization codec).
 *
 * Zarr v2 is simpler: a single `compressor.id` that is always an actual
 * compression codec, so it does not need classification.
 */

/** Classification of a codec for compression-compatibility purposes. */
export type CodecCompression = "compression" | "structural" | "unknown";

/**
 * Codecs that compress data. A viewer must be able to decompress these to read
 * the dataset, so they are compared against the viewer's `compression_codecs`.
 * Both the bare Zarr v3 names and the `numcodecs.*`-namespaced variants emitted
 * by some writers are recognized.
 */
const COMPRESSION_CODECS = new Set([
  "blosc",
  "gzip",
  "zstd",
  "lz4",
  "lzma",
  "zlib",
  "numcodecs.blosc",
  "numcodecs.gzip",
  "numcodecs.zstd",
  "numcodecs.lz4",
  "numcodecs.lzma",
  "numcodecs.zlib",
]);

/**
 * Codecs that do not compress data: array_to_array transforms (transpose,
 * bitround), array_to_bytes serialization codecs (bytes, sharding_indexed,
 * vlen-utf8, json2), and bytes_to_bytes checksums (crc32c). A viewer does not
 * need to declare support for these to read compressed data, so they are not
 * compared against `compression_codecs`. Kept in sync with zarrita's codec
 * registry by codecs.zarrita.test.ts.
 */
const STRUCTURAL_CODECS = new Set([
  "bytes",
  "endian", // legacy name for the array_to_bytes codec
  "transpose",
  "sharding_indexed",
  "crc32c",
  "vlen-utf8",
  "json2",
  "bitround",
]);

/**
 * Classify a Zarr codec by its relevance to compression compatibility.
 *
 * Returns `"unknown"` for any codec not in the static registries above, so the
 * caller can surface uncertainty (a warning) rather than guess — guessing
 * "compression" re-introduces the false-incompatible bug for novel serialization
 * codecs, while guessing "structural" silently hides genuine incompatibility.
 */
export function classifyCodec(name: string): CodecCompression {
  if (COMPRESSION_CODECS.has(name)) return "compression";
  if (STRUCTURAL_CODECS.has(name)) return "structural";
  return "unknown";
}
