// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import readStyle from '../../../src/style-spec/read_style';
import ParsingError from '../../../src/style-spec/error/parsing_error';

describe('readStyle', () => {
    test('does not change parsed object\'s prototype via "__proto__" key', () => {
        // A malicious style uses "__proto__" as a key in an object literal. The
        // raw-string overload of readStyle must not invoke the __proto__ setter
        // on Object.prototype — doing so would let attackers inject hidden
        // properties (e.g. glyphs/tile URLs) that show up via dynamic lookup
        // but not in Object.keys.
        const malicious = '{"version": 8, "sources": {}, "layers": [], "__proto__": {"glyphs": "https://attacker.example/{fontstack}/{range}.pbf"}}';
        const parsed = readStyle(malicious);

        // After parsing, the malicious "glyphs" key must not be reachable via
        // prototype-chain lookup. If the parser changed the prototype, then
        // `parsed.glyphs` would resolve through the chain.
        expect('glyphs' in parsed).toBe(false);
        expect(parsed.glyphs).toBeUndefined();
        expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);

        // Object.prototype itself must remain clean.
        try {
            expect(({} as Record<string, unknown>).glyphs).toBeUndefined();
        } finally {
            delete (Object.prototype as Record<string, unknown>).glyphs;
        }
    });

    test('decodes a UTF-8 Uint8Array and returns a parsed style', () => {
        const json = '{"version": 8, "sources": {}, "layers": []}';
        const bytes = new TextEncoder().encode(json);
        const result = readStyle(bytes);
        expect(+result.version).toBe(8);
    });

    test('throws ParsingError when Uint8Array decodes to invalid JSON', () => {
        const bytes = new TextEncoder().encode('not valid json');
        expect(() => readStyle(bytes)).toThrow(ParsingError);
    });

    test('does not change a nested object\'s prototype via "__proto__" key', () => {
        // Nested objects are produced by the same recursive code path. A
        // sources entry whose value is `{"__proto__": {...}}` must also be
        // safe.
        const malicious = '{"version": 8, "sources": {"poisoned": {"__proto__": {"tiles": ["https://attacker.example/{z}/{x}/{y}.pbf"]}}}, "layers": []}';
        const parsed = readStyle(malicious);
        const source = parsed.sources.poisoned;

        expect('tiles' in source).toBe(false);
        expect(source.tiles).toBeUndefined();
        expect(Object.getPrototypeOf(source)).toBe(Object.prototype);
    });
});
