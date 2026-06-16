import { describe, it, expect } from 'vitest';
import { classifyCodec } from './codecs.js';

describe('classifyCodec', () => {
  describe('compression codecs', () => {
    it.each(['blosc', 'gzip', 'zstd', 'lz4', 'lzma', 'zlib'])(
      'classifies %s as compression',
      (name) => {
        expect(classifyCodec(name)).toBe('compression');
      }
    );

    it('classifies numcodecs-namespaced compressors as compression', () => {
      expect(classifyCodec('numcodecs.blosc')).toBe('compression');
      expect(classifyCodec('numcodecs.zstd')).toBe('compression');
    });
  });

  describe('structural codecs', () => {
    it.each(['bytes', 'endian', 'transpose', 'sharding_indexed', 'crc32c'])(
      'classifies %s as structural',
      (name) => {
        expect(classifyCodec(name)).toBe('structural');
      }
    );
  });

  describe('unknown codecs', () => {
    it('classifies an unrecognized codec name as unknown', () => {
      expect(classifyCodec('some-future-codec')).toBe('unknown');
    });
  });
});
