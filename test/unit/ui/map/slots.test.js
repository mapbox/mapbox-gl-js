import {describe, test, expect, waitFor, createMap, createStyleJSON} from '../../../util/vitest.js';

describe('Map#slots', () => {
    describe('#getSlot', () => {
        test('should return slot identifier of layer', async () => {
            const map = createMap({
                style: createStyleJSON({
                    imports: [
                        {
                            id: 'basemap',
                            url: 'mapbox://styles/mapbox/standard',
                            data: createStyleJSON({
                                layers: [
                                    {
                                        id: 'top',
                                        type: 'slot'
                                    }
                                ]
                            })
                        }
                    ],
                    layers: [
                        {
                            id: 'background',
                            type: 'background',
                            slot: 'top',
                            paint: {
                                'background-color': '#000'
                            }
                        }
                    ]
                })
            });

            await waitFor(map, 'load');

            expect(map.getSlot('background')).toBe('top');
        });
    });
});
