import {test, expect, createMap, waitFor} from '../util/vitest.js';
import {simulateDoubleTap} from '../util/simulate_interaction.js';
import land from '../util/fixtures/land.json';
import mapboxgl from '../../src/index.js';

test('Performance metrics collected', async () => {
    const map = createMap({
        interactive: true,
        zoom: 1,
        fadeDuration: 0,
        center: [0, 0],
        style: {
            version: 8,
            sources: {
                land: {
                    type: 'geojson',
                    data: land
                }
            },
            layers: [
                {
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-color': '#72d0f2'
                    }
                },
                {
                    id: 'land',
                    type: 'fill',
                    source: 'land',
                    paint: {
                        'fill-color': '#f0e9e1'
                    }
                }
            ]
        }
    });

    await waitFor(map, 'load');
    await simulateDoubleTap(map);
    await waitFor(map, 'idle');

    const performance = await new Promise((resolve, reject) => {
        mapboxgl.getPerformanceMetricsAsync((err, result) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(result);
        });
    });

    const timelines = performance.timelines;
    expect(timelines.length).toEqual(3);
    expect(timelines[0].scope).toEqual('Window');
    expect(timelines[1].scope).toEqual('Worker');
    expect(timelines[2].scope).toEqual('Worker');

    const find = name => timelines[0].entries.find(e => e.name === name);

    expect(timelines[0].entries.every(e => {
        return !isNaN(e.startTime) && !isNaN(e.duration);
    })).toBeTruthy();

    expect(find('library-evaluate')).toBeTruthy();
    expect(find('frame')).toBeTruthy();
    expect(find('create')).toBeTruthy();
    expect(find('load')).toBeTruthy();
    expect(find('fullLoad')).toBeTruthy();
});
