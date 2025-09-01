// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, createMap, waitFor} from '../util/vitest';
import {simulateDoubleTap} from '../util/simulate_interaction';
import land from '../util/fixtures/land.json';
import mapboxgl from '../../src/index';

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        mapboxgl.getPerformanceMetricsAsync((err, result) => {
            if (err) {
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                reject(err);
                return;
            }

            resolve(result);
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const timelines = performance.timelines;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(timelines.length).toEqual(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(timelines[0].scope).toEqual('Window');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(timelines[1].scope).toEqual('Worker');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(timelines[2].scope).toEqual('Worker');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const find = name => timelines[0].entries.find(e => e.name === name);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    expect(timelines[0].entries.every(e => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        return !isNaN(e.startTime) && !isNaN(e.duration);
    })).toBeTruthy();

    expect(find('library-evaluate')).toBeTruthy();
    expect(find('frame')).toBeTruthy();
    expect(find('create')).toBeTruthy();
    expect(find('load')).toBeTruthy();
    expect(find('fullLoad')).toBeTruthy();
});
