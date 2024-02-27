import {describe, test, expect} from "../../util/vitest.js";
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import classifyRings from '../../../src/util/classify_rings.js';
// eslint-disable-next-line import/no-unresolved
import vectorTileStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';

// Load a fill feature from fixture tile.
const vt = new VectorTile(new Protobuf(vectorTileStub));
const feature = vt.layers.water.feature(0);

test('classifyRings', () => {
    let geometry;
    let classified;

    geometry = [
        [
            {x:0, y:0},
            {x:0, y:40},
            {x:40, y:40},
            {x:40, y:0},
            {x:0, y:0}
        ]
    ];
    classified = classifyRings(geometry);
    expect(classified.length).toEqual(1);
    expect(classified[0].length).toEqual(1);

    geometry = [
        [
            {x:0, y:0},
            {x:0, y:40},
            {x:40, y:40},
            {x:40, y:0},
            {x:0, y:0}
        ],
        [
            {x:60, y:0},
            {x:60, y:40},
            {x:100, y:40},
            {x:100, y:0},
            {x:60, y:0}
        ]
    ];
    classified = classifyRings(geometry);
    expect(classified.length).toEqual(2);
    expect(classified[0].length).toEqual(1);
    expect(classified[1].length).toEqual(1);

    geometry = [
        [
            {x:0, y:0},
            {x:0, y:40},
            {x:40, y:40},
            {x:40, y:0},
            {x:0, y:0}
        ],
        [
            {x:10, y:10},
            {x:20, y:10},
            {x:20, y:20},
            {x:10, y:10}
        ]
    ];
    classified = classifyRings(geometry);
    expect(classified.length).toEqual(1);
    expect(classified[0].length).toEqual(2); // polygon 1 has 1 exterior, 1 interior

    geometry = feature.loadGeometry();
    classified = classifyRings(geometry);
    expect(classified.length).toEqual(2);
    expect(classified[0].length).toEqual(1); // polygon 1 has 1 exterior
    expect(classified[1].length).toEqual(10); // polygon 2 has 1 exterior, 9 interior
});

describe('classifyRings + maxRings', () => {
    function createGeometry(options) {
        const geometry = [
            // Outer ring, area = 3200
            [ {x:0, y:0}, {x:0, y:40}, {x:40, y:40}, {x:40, y:0}, {x:0, y:0} ],
            // Inner ring, area = 100
            [ {x:30, y:30}, {x:32, y:30}, {x:32, y:32}, {x:30, y:30} ],
            // Inner ring, area = 4
            [ {x:10, y:10}, {x:20, y:10}, {x:20, y:20}, {x:10, y:10} ]
        ];
        if (options && options.reverse) {
            geometry[0].reverse();
            geometry[1].reverse();
            geometry[2].reverse();
        }
        return geometry;
    }

    test('maxRings=undefined', () => {
        const geometry = sortRings(classifyRings(createGeometry()));
        expect(geometry.length).toEqual(1);
        expect(geometry[0].length).toEqual(3);
        expect(geometry[0][0].area).toEqual(3200);
        expect(geometry[0][1].area).toEqual(100);
        expect(geometry[0][2].area).toEqual(4);
    });

    test('maxRings=2', () => {
        const geometry = sortRings(classifyRings(createGeometry(), 2));
        expect(geometry.length).toEqual(1);
        expect(geometry[0].length).toEqual(2);
        expect(geometry[0][0].area).toEqual(3200);
        expect(geometry[0][1].area).toEqual(100);
    });

    test('maxRings=2, reversed geometry', () => {
        const geometry = sortRings(classifyRings(createGeometry({reverse: true}), 2));
        expect(geometry.length).toEqual(1);
        expect(geometry[0].length).toEqual(2);
        expect(geometry[0][0].area).toEqual(3200);
        expect(geometry[0][1].area).toEqual(100);
    });

    test('maxRings=5, geometry from fixture', () => {
        const geometry = sortRings(classifyRings(feature.loadGeometry(), 5));
        expect(geometry.length).toEqual(2);
        expect(geometry[0].length).toEqual(1);
        expect(geometry[1].length).toEqual(5);

        const areas = geometry[1].map((ring) => { return ring.area; });
        expect(areas).toEqual([2763951, 21600, 8298, 4758, 3411]);
    });
});

function sortRings(geometry) {
    for (let i = 0; i < geometry.length; i++) {
        geometry[i] = geometry[i].sort(compareAreas);
    }
    return geometry;
}

function compareAreas(a, b) {
    return b.area - a.area;
}
