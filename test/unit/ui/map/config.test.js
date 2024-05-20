import {describe, test, expect, waitFor, createMap} from '../../../util/vitest.js';
import {createStyle} from '../map/util.js';

describe('Map#config', () => {
    test('#setConfig and #getConfig', async () => {
        const map = createMap({
            style: createStyle({
                schema: {
                    lightPreset: {type: 'string', default: 'day'},
                    showPointOfInterestLabels: {type: 'boolean', default: true}
                }
            })
        });

        await waitFor(map, 'style.load');

        expect(map.getConfig('basemap')).toEqual({
            lightPreset: 'day',
            showPointOfInterestLabels: true
        });

        map.setConfig('basemap', {
            lightPreset: 'night',
            showPointOfInterestLabels: false
        });

        expect(map.getConfig('basemap')).toEqual({
            lightPreset: 'night',
            showPointOfInterestLabels: false
        });
    });

    test('#setConfigProperty and #getConfigProperty', async () => {
        const map = createMap({
            style: createStyle({
                schema: {
                    lightPreset: {type: 'string', default: 'day'},
                    showPointOfInterestLabels: {type: 'boolean', default: true}
                }
            })
        });

        await waitFor(map, 'style.load');

        expect(map.getConfigProperty('basemap', 'lightPreset')).toEqual('day');
        expect(map.getConfigProperty('basemap', 'showPointOfInterestLabels')).toEqual(true);

        map.setConfigProperty('basemap', 'lightPreset', 'night');
        map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);

        expect(map.getConfigProperty('basemap', 'lightPreset')).toEqual('night');
        expect(map.getConfigProperty('basemap', 'showPointOfInterestLabels')).toEqual(false);
    });
});
