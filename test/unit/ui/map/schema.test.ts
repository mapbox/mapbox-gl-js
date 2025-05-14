// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, createMap} from '../../../util/vitest';
import {createStyle} from '../map/util';

describe('Map#schema', () => {
    test('#setSchema and #getSchema', async () => {
        const map = createMap({
            style: createStyle({
                schema: {
                    lightPreset: {type: 'string', default: 'day'},
                    showPointOfInterestLabels: {type: 'boolean', default: true}
                }
            })
        });

        await waitFor(map, 'style.load');

        expect(map.getSchema('basemap')).toEqual({
            lightPreset: {type: 'string', default: 'day'},
            showPointOfInterestLabels: {type: 'boolean', default: true}
        });

        map.setSchema('basemap', {
            lightPreset: {type: 'string', default: 'night', values: ['day', 'night']},
            showPointOfInterestLabels: {type: 'boolean', default: false}
        });

        expect(map.getSchema('basemap')).toEqual({
            lightPreset: {type: 'string', default: 'night', values: ['day', 'night']},
            showPointOfInterestLabels: {type: 'boolean', default: false}
        });
    });
});
