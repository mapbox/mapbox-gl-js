import {test} from '../../util/test';
import format from '../../../src/style-spec/format';

function roundtrip(style) {
    return JSON.parse(format(style));
}

test('orders top-level keys', (t) => {
    t.deepEqual(Object.keys(roundtrip({
        "layers": [],
        "other": {},
        "sources": {},
        "glyphs": "",
        "sprite": "",
        "version": 6
    })), ['version', 'sources', 'sprite', 'glyphs', 'layers', 'other']);
    t.end();
});

test('orders layer keys', (t) => {
    t.deepEqual(Object.keys(roundtrip({
        "layers": [{
            "paint": {},
            "layout": {},
            "id": "id",
            "type": "type"
        }]
    }).layers[0]), ['id', 'type', 'layout', 'paint']);
    t.end();
});
