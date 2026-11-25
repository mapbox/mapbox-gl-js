// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, createMap} from '../../../util/vitest';
import {createStyle} from './util';

describe('Map style transition', () => {
    describe('a style setter keeps the transition duration', () => {
        test('setFog', async () => {
            const map = createMap({style: createStyle({transition: {duration: 1000, delay: 0}})});
            await waitFor(map, 'load');

            map.setFog({});

            expect(map.getTransition().duration).toBe(1000);
        });

        test('setTerrain', async () => {
            const map = createMap({style: createStyle({transition: {duration: 1000, delay: 0}})});
            await waitFor(map, 'load');
            map.addSource('dem', {type: 'raster-dem', tiles: ['https://tiles/{z}-{x}-{y}.terrain.png']});

            map.setTerrain({source: 'dem'});

            expect(map.getTransition().duration).toBe(1000);
        });

        test('setRain', async () => {
            const map = createMap({style: createStyle({transition: {duration: 1000, delay: 0}})});
            await waitFor(map, 'load');

            map.setRain({});

            expect(map.getTransition().duration).toBe(1000);
        });

        test('setSnow', async () => {
            const map = createMap({style: createStyle({transition: {duration: 1000, delay: 0}})});
            await waitFor(map, 'load');

            map.setSnow({});

            expect(map.getTransition().duration).toBe(1000);
        });

        test('setFog on a style without a transition', async () => {
            const map = createMap({style: createStyle()});
            await waitFor(map, 'load');

            map.setFog({});

            expect(map.getTransition().duration).toBe(300);
        });
    });

    describe('#getTransition', () => {
        test('returns the default transition of a style without a transition', async () => {
            const map = createMap({style: createStyle()});
            await waitFor(map, 'load');

            expect(map.getTransition()).toEqual({duration: 300, delay: 0});
        });

        test('returns the transition of the style', async () => {
            const map = createMap({style: createStyle({transition: {duration: 500}})});
            await waitFor(map, 'load');

            expect(map.getTransition()).toEqual({duration: 500, delay: 0});
        });

        test('returns a copy', async () => {
            const map = createMap({style: createStyle()});
            await waitFor(map, 'load');

            map.getTransition().duration = 5000;

            expect(map.getTransition()).toEqual({duration: 300, delay: 0});
        });
    });

    describe('#setTransition', () => {
        test('sets the duration and the delay', async () => {
            const map = createMap({style: createStyle()});
            await waitFor(map, 'load');

            map.setTransition({duration: 1000, delay: 50});

            expect(map.getTransition()).toEqual({duration: 1000, delay: 50});
        });

        test('keeps a value that is not given', async () => {
            const map = createMap({style: createStyle({transition: {duration: 500, delay: 20}})});
            await waitFor(map, 'load');

            map.setTransition({duration: 1000});

            expect(map.getTransition()).toEqual({duration: 1000, delay: 20});
        });

        test('keeps a value that is not given and that comes from an import', async () => {
            const map = createMap({
                style: createStyle({
                    imports: [{
                        id: 'basemap',
                        url: '',
                        data: {version: 8, sources: {}, layers: [], transition: {duration: 0}},
                    }],
                }),
            });
            await waitFor(map, 'style.load');
            expect(map.getTransition()).toEqual({duration: 0, delay: 0});

            map.setTransition({delay: 100});

            expect(map.getTransition()).toEqual({duration: 0, delay: 100});
        });

        test('uses the default for a value that is not given and that the style does not specify', async () => {
            const map = createMap({style: createStyle()});
            await waitFor(map, 'load');

            map.setTransition({duration: 1000});

            expect(map.getTransition()).toEqual({duration: 1000, delay: 0});
        });

        test('is replaced by the transition of a style that loads later', async () => {
            const map = createMap({style: createStyle({transition: {duration: 500, delay: 20}})});

            map.setTransition({duration: 1000, delay: 50});
            await waitFor(map, 'load');

            expect(map.getTransition()).toEqual({duration: 500, delay: 20});
        });

        test('is replaced by the transition of a new style that is diffed', async () => {
            const map = createMap({style: createStyle()});
            await waitFor(map, 'load');
            const style = map.style;
            map.setTransition({duration: 1000, delay: 50});

            map.setStyle(createStyle({transition: {duration: 500, delay: 20}, layers: [{id: 'background', type: 'background'}]}));

            expect(map.style).toBe(style);
            expect(map.getTransition()).toEqual({duration: 500, delay: 20});
        });

        test('is replaced by the default transition of a new style without a transition', async () => {
            const map = createMap({style: createStyle()});
            await waitFor(map, 'load');
            map.setTransition({duration: 1000, delay: 50});

            map.setStyle(createStyle({layers: [{id: 'background', type: 'background'}]}), {diff: false});
            await waitFor(map, 'style.load');

            expect(map.getTransition()).toEqual({duration: 300, delay: 0});
        });
    });

    describe('fade duration', () => {
        test('#getFadeDuration returns the default value', () => {
            const map = createMap({style: createStyle()});

            expect(map.getFadeDuration()).toBe(300);
        });

        test('#getFadeDuration returns the fadeDuration map option', () => {
            const map = createMap({style: createStyle(), fadeDuration: 100});

            expect(map.getFadeDuration()).toBe(100);
        });

        test('#setFadeDuration sets the fade duration', () => {
            const map = createMap({style: createStyle()});

            map.setFadeDuration(0);

            expect(map.getFadeDuration()).toBe(0);
        });
    });
});
