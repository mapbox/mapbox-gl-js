// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import format from '../../../src/style-spec/format';

function roundtrip(style) {
    return JSON.parse(format(style));
}

test('orders top-level keys', () => {
    expect(Object.keys(roundtrip({
        "layers": [],
        "other": {},
        "sources": {},
        "glyphs": "",
        "sprite": "",
        "version": 6
    }))).toEqual(['version', 'sources', 'sprite', 'glyphs', 'layers', 'other']);
});

test('orders layer keys', () => {
    expect(Object.keys(roundtrip({
        "layers": [{
            "paint": {},
            "layout": {},
            "id": "id",
            "type": "type"
        }]
    }).layers[0])).toEqual(['id', 'type', 'layout', 'paint']);
});
