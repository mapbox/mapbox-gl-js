// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import Wrapper from '../../../src/source/geojson_wrapper';

describe('geojsonwrapper', () => {
    test('linestring', () => {
        const features = [{
            type: 2,
            geometry: [[[0, 0], [10, 10]]],
            tags: {hello: 'world'}
        }];

        const wrap = new Wrapper({test: features});
        const feature = wrap.layers.test.feature(0);

        expect(feature).toBeTruthy();
        expect(feature.loadGeometry()).toEqual([[{x: 0, y: 0}, {x: 10, y: 10}]]);
        expect(feature.type).toEqual(2);
        expect(feature.properties).toEqual({hello: 'world'});
    });

    test('point', () => {
        const features = [{
            type: 1,
            geometry: [[0, 1]],
            tags: {}
        }];

        const wrap = new Wrapper({test: features});
        const feature = wrap.layers.test.feature(0);
        expect(feature.loadGeometry()).toEqual([[{x: 0, y: 1}]]);
    });
});
