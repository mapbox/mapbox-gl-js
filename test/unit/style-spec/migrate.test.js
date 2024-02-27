import {test, expect} from "../../util/vitest.js";
import validate from '../../../src/style-spec/validate_style.js';
import v8 from '../../../src/style-spec/reference/v8.json';
import migrate from '../../../src/style-spec/migrate.js';

/* eslint-disable import/namespace */
import * as spec from '../../../src/style-spec/style-spec.js';

test('does not migrate from version 5', () => {
    expect(() => {
        migrate({version: 5, layers: []});
    }).toThrowError('cannot migrate from');
});

test('does not migrate from version 6', () => {
    expect(() => {
        migrate({version: 6, layers: []});
    }).toThrowError('cannot migrate from');
});

test('migrates to latest version from version 7', () => {
    expect(migrate({version: 7, layers: []}).version).toEqual(spec.latest.$version);
});

test('converts token strings to expressions', () => {
    const migrated = migrate({
        version: 8,
        layers: [{
            id: '1',
            type: 'symbol',
            layout: {'text-field': 'a{x}', 'icon-image': '{y}'}
        }]
    }, spec.latest.$version);
    expect(migrated.layers[0].layout['text-field']).toEqual(['concat', 'a', ['get', 'x']]);
    expect(migrated.layers[0].layout['icon-image']).toEqual(['to-string', ['get', 'y']]);
});

test('converts stop functions to expressions', () => {
    const migrated = migrate({
        version: 8,
        layers: [{
            id: '1',
            type: 'background',
            paint: {
                'background-opacity': {
                    base: 1.0,
                    stops: [[0, 1], [10, 0.72]]
                }
            }
        }, {
            id: '2',
            type: 'background',
            paint: {
                'background-opacity': {
                    base: 1.0,
                    stops: [[0, [1, 2]], [10, [0.72, 0.98]]]
                }
            }
        }]
    }, spec.latest.$version);
    expect(migrated.layers[0].paint['background-opacity']).toEqual([
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        1,
        10,
        0.72
    ]);
    expect(migrated.layers[1].paint['background-opacity']).toEqual([
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        ['literal', [1, 2]],
        10,
        ['literal', [0.72, 0.98]]
    ]);
});

test('converts categorical function on resolvedImage type to valid expression', () => {
    window.Buffer = class {};
    const migrated = migrate({
        version: 8,
        sources: {
            streets: {
                url: 'mapbox://mapbox.streets',
                type: 'vector'
            }
        },
        layers: [{
            id: '1',
            source: 'streets',
            'source-layer': 'labels',
            type: 'symbol',
            layout: {
                'icon-image': {
                    base: 1,
                    type: 'categorical',
                    property: 'type',
                    stops: [['park', 'some-icon']]
                }
            }
        }]
    }, spec.latest.$version);
    expect(migrated.layers[0].layout['icon-image']).toEqual([
        "match",
        ["get", "type" ],
        "park",
        "some-icon",
        ""
    ]);
    expect(validate(migrated, v8)).toEqual([]);
});
