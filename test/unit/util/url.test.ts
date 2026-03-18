import {describe, test, expect} from 'vitest';
import {getURLExtension} from '../../../src/util/url';

describe('getURLExtension', () => {
    test('extracts extension', () => {
        expect(getURLExtension('https://example.com/path/tiles.pmtiles')).toBe('pmtiles');
    });

    test('returns last extension for multiple dots', () => {
        expect(getURLExtension('https://example.com/my.tiles.pbf')).toBe('pbf');
    });

    test('ignores query and fragment', () => {
        expect(getURLExtension('https://example.com/tiles.pmtiles?token=abc#s')).toBe('pmtiles');
    });

    test('returns empty for no extension', () => {
        expect(getURLExtension('https://example.com/tiles')).toBe('');
    });

    test('returns empty for invalid URL', () => {
        expect(getURLExtension('not a url')).toBe('');
        expect(getURLExtension('')).toBe('');
    });

    test('returns empty for mapbox:// URLs', () => {
        expect(getURLExtension('mapbox://mapbox.mapbox-streets-v8')).toBe('');
    });
});
