// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, createMap} from '../../../util/vitest';

describe('Map#setCooperativeGestures', () => {
    test('cooperative gestures in constructor', async () => {
        let map = createMap({
            cooperativeGestures: true
        });

        await waitFor(map, 'style.load');

        expect(map.getCooperativeGestures()).toEqual(true);

        map = createMap({
            cooperativeGestures: false
        });

        await waitFor(map, 'style.load');

        expect(map.getCooperativeGestures()).toEqual(false);
    });

    test('#get and set Coopertive Gestures', () => {
        const map = createMap();
        map.setCooperativeGestures(true);
        expect(map.getCooperativeGestures()).toEqual(true);
        map.setCooperativeGestures(false);
        expect(map.getCooperativeGestures()).toEqual(false);
    });
});
