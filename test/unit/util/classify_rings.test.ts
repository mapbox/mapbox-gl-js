// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import classifyRings from '../../../src/util/classify_rings';
import vectorTileStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';

// Load a fill feature from fixture tile.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const vt = new VectorTile(new Protobuf(vectorTileStub));
const feature = vt.layers.water.feature(0);

test('classifyRings', () => {
    let geometry: any;
    let classified: any;

    geometry = [
        [
            {x: 0, y: 0},
            {x: 0, y: 40},
            {x: 40, y: 40},
            {x: 40, y: 0},
            {x: 0, y: 0}
        ]
    ];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    classified = classifyRings(geometry);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified.length).toEqual(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified[0].length).toEqual(1);

    geometry = [
        [
            {x: 0, y: 0},
            {x: 0, y: 40},
            {x: 40, y: 40},
            {x: 40, y: 0},
            {x: 0, y: 0}
        ],
        [
            {x: 60, y: 0},
            {x: 60, y: 40},
            {x: 100, y: 40},
            {x: 100, y: 0},
            {x: 60, y: 0}
        ]
    ];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    classified = classifyRings(geometry);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified.length).toEqual(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified[0].length).toEqual(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified[1].length).toEqual(1);

    geometry = [
        [
            {x: 0, y: 0},
            {x: 0, y: 40},
            {x: 40, y: 40},
            {x: 40, y: 0},
            {x: 0, y: 0}
        ],
        [
            {x: 10, y: 10},
            {x: 20, y: 10},
            {x: 20, y: 20},
            {x: 10, y: 10}
        ]
    ];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    classified = classifyRings(geometry);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified.length).toEqual(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified[0].length).toEqual(2); // polygon 1 has 1 exterior, 1 interior

    geometry = feature.loadGeometry();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    classified = classifyRings(geometry);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified.length).toEqual(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified[0].length).toEqual(1); // polygon 1 has 1 exterior
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(classified[1].length).toEqual(10); // polygon 2 has 1 exterior, 9 interior
});

describe('classifyRings + maxRings', () => {
    function createGeometry(options) {
        const geometry = [
            // Outer ring, area = 3200
            [{x: 0, y: 0}, {x: 0, y: 40}, {x: 40, y: 40}, {x: 40, y: 0}, {x: 0, y: 0}],
            // Inner ring, area = 100
            [{x: 30, y: 30}, {x: 32, y: 30}, {x: 32, y: 32}, {x: 30, y: 30}],
            // Inner ring, area = 4
            [{x: 10, y: 10}, {x: 20, y: 10}, {x: 20, y: 20}, {x: 10, y: 10}]
        ];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (options && options.reverse) {
            geometry[0].reverse();
            geometry[1].reverse();
            geometry[2].reverse();
        }
        return geometry;
    }

    test('maxRings=undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const geometry = sortRings(classifyRings(createGeometry()));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry.length).toEqual(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0].length).toEqual(3);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0][0].area).toEqual(3200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0][1].area).toEqual(100);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0][2].area).toEqual(4);
    });

    test('maxRings=2', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const geometry = sortRings(classifyRings(createGeometry(), 2));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry.length).toEqual(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0].length).toEqual(2);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0][0].area).toEqual(3200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0][1].area).toEqual(100);
    });

    test('maxRings=2, reversed geometry', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const geometry = sortRings(classifyRings(createGeometry({reverse: true}), 2));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry.length).toEqual(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0].length).toEqual(2);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0][0].area).toEqual(3200);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0][1].area).toEqual(100);
    });

    test('maxRings=5, geometry from fixture', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const geometry = sortRings(classifyRings(feature.loadGeometry(), 5));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry.length).toEqual(2);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[0].length).toEqual(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(geometry[1].length).toEqual(5);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const areas = geometry[1].map((ring) => { return ring.area; });
        expect(areas).toEqual([2763951, 21600, 8298, 4758, 3411]);
    });
});

function sortRings(geometry) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (let i = 0; i < geometry.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        geometry[i] = geometry[i].sort(compareAreas);
    }
    return geometry;
}

function compareAreas(a, b) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return b.area - a.area;
}
