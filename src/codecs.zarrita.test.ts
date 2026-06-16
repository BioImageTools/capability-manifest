/**
 * Cross-check our hand-maintained codec classification against zarrita's actual
 * codec registry. zarrita is a devDependency only — this coupling exists purely
 * to keep `classifyCodec` honest, so the runtime library stays sync and
 * dependency-free (see codecs.ts). If zarrita adds or re-classifies a codec,
 * these tests fail and prompt us to update the table deliberately.
 */
import { describe, it, expect } from 'vitest';
import { registry } from 'zarrita';
import { classifyCodec } from './codecs.js';

type Kind = 'array_to_array' | 'array_to_bytes' | 'bytes_to_bytes';

// Best-effort extraction of a codec's pipeline `kind`. `kind` is a per-instance
// field, so the codec must be instantiated; some (numcodecs-backed blosc/lz4/
// zstd) cannot be constructed without async wasm init, so we return undefined
// and skip kind-based assertions for those — the "no unknowns" check still
// covers them.
async function kindOf(name: string): Promise<Kind | undefined> {
  try {
    const Codec = (await registry.get(name)?.()) as
      | { fromConfig: (cfg: unknown, meta: unknown) => { kind: Kind } }
      | undefined;
    if (!Codec) return undefined;
    const meta = { data_type: 'uint8', shape: [4, 4], chunk_shape: [2, 2], codecs: [] };
    for (const cfg of [{}, { endian: 'little' }, { order: [0, 1] }, { keepbits: 8 }]) {
      try {
        return Codec.fromConfig(cfg, meta).kind;
      } catch {
        /* try next config shape */
      }
    }
  } catch {
    /* codec module failed to load */
  }
  return undefined;
}

describe('classifyCodec cross-check against zarrita registry', () => {
  const names = [...registry.keys()];

  it('classifies every codec in zarrita\'s registry (no unknowns)', () => {
    const unknown = names.filter((n) => classifyCodec(n) === 'unknown');
    expect(unknown).toEqual([]);
  });

  it.each(names)(
    'classification of "%s" is consistent with its zarrita kind',
    async (name) => {
      const kind = await kindOf(name);
      const classification = classifyCodec(name);

      // array_to_array transforms and array_to_bytes serialization codecs are
      // never compression — misclassifying one as compression is the exact
      // false-incompatible bug this guards against.
      if (kind === 'array_to_array' || kind === 'array_to_bytes') {
        expect(classification).toBe('structural');
      }

      // Anything we call compression must be a bytes_to_bytes codec in zarrita.
      if (classification === 'compression' && kind !== undefined) {
        expect(kind).toBe('bytes_to_bytes');
      }
    }
  );
});
