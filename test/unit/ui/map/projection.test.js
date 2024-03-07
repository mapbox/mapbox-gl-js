import {beforeEach, describe, test, expect, waitFor, vi, createMap} from '../../../util/vitest.js';
import {fixedLngLat} from '../../../util/fixed.js';

function pointToFixed(p, n = 8) {
    return {
        'x': p.x.toFixed(n),
        'y': p.y.toFixed(n)
    };
}

describe('Map#projection', () => {
    describe('#getProjection', () => {
        test('map defaults to Mercator', () => {
            const map = createMap();
            expect(map.getProjection()).toEqual({name: 'mercator', center: [0, 0]});
        });

        test('respects projection options object', () => {
            const options = {
                name: 'albers',
                center: [12, 34],
                parallels: [10, 42]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual(options);
        });

        test('respects projection options string', () => {
            const map = createMap({projection: 'albers'});
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
        });

        test('composites user and default projection options', () => {
            const options = {
                name: 'albers',
                center: [12, 34]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [12, 34],
                parallels: [29.5, 45.5]
            });
        });

        test('does not composite user and default projection options for non-conical projections', () => {
            const options = {
                name: 'naturalEarth',
                center: [12, 34]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual({
                name: 'naturalEarth',
                center: [0, 0]
            });
        });

        test('returns conic projections when cylindrical functions are used', () => {
            let options = {
                name: 'albers',
                center: [12, 34],
                parallels: [40, -40]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual(options);
            options = {name: 'lambertConformalConic', center: [20, 25], parallels: [30, -30]};
            map.setProjection(options);
            expect(map.getProjection()).toEqual(options);
            expect(map._showingGlobe()).toBeFalsy();
        });

        test('returns Albers projection at high zoom', async () => {
            const map = createMap({projection: 'albers'});
            map.setZoom(12);
            await waitFor(map, "render");
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
            expect(map.getProjection()).toEqual(map.transform.getProjection());
            expect(map._showingGlobe()).toBeFalsy();
        });

        test('returns globe projection at low zoom', async () => {
            const map = createMap({projection: 'globe'});
            await waitFor(map, "render");
            expect(map.getProjection()).toEqual({
                name: 'globe',
                center: [0, 0],
            });
            expect(map.getProjection()).toEqual(map.transform.getProjection());
            expect(map._showingGlobe()).toBeTruthy();
        });

        test('returns globe projection at high zoom', async () => {
            const map = createMap({projection: 'globe'});
            map.setZoom(12);
            await waitFor(map, "render");
            expect(map.getProjection()).toEqual({
                name: 'globe',
                center: [0, 0],
            });
            expect(map.transform.getProjection()).toEqual({
                name: 'mercator',
                center: [0, 0],
            });
            expect(map._showingGlobe()).toBeFalsy();
        });

        test('Crossing globe-to-mercator zoom threshold sets mercator transition and calculates matrices', async () => {
            const map = createMap({projection: 'globe'});

            await waitFor(map, "load");

            vi.spyOn(map.transform, 'setMercatorFromTransition');
            vi.spyOn(map.transform, '_calcMatrices');

            expect(map.transform.setMercatorFromTransition).not.toHaveBeenCalled();
            expect(map.transform.mercatorFromTransition).toEqual(false);
            expect(map.transform._calcMatrices).not.toHaveBeenCalled();

            map.setZoom(7);

            await waitFor(map, "render");
            expect(map.transform.setMercatorFromTransition).toHaveBeenCalledTimes(1);
            expect(map.transform.mercatorFromTransition).toEqual(true);
            expect(map.transform._calcMatrices).toHaveBeenCalledTimes(3);
        });

        test('Changing zoom on globe does not clear tiles', async () => {
            const map = createMap({projection: 'globe'});
            vi.spyOn(map.painter, 'clearBackgroundTiles');
            await waitFor(map, "load");
            expect(map.painter.clearBackgroundTiles).not.toHaveBeenCalled();
            expect(map.getProjection().name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual(`globe`);
            expect(map._showingGlobe()).toBeTruthy();

            map.setZoom(12);
            await waitFor(map, "render");
            expect(map.painter.clearBackgroundTiles).not.toHaveBeenCalled();
            expect(map.getProjection().name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual(`mercator`);
            expect(map._showingGlobe()).toBeFalsy();

            map.setProjection({name: 'mercator'});
            expect(map.painter.clearBackgroundTiles).not.toHaveBeenCalled();
            expect(map.getProjection().name).toEqual('mercator');
            expect(map.transform.getProjection().name).toEqual(`mercator`);
            expect(map._showingGlobe()).toBeFalsy();

            map.setZoom(3);
            await waitFor(map, "render");
            map.setProjection({name: 'globe'});
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(1);
            expect(map.getProjection().name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual(`globe`);
            expect(map._showingGlobe()).toBeTruthy();
        });

        // Behavior described at https://github.com/mapbox/mapbox-gl-js/pull/11204
        test('runtime projection overrides style projection', async () => {
            const map = createMap({style: {
                "version": 8,
                "projection": {
                    "name": "albers"
                },
                "sources": {},
                "layers": []
            }});
            const style = map.style;
            vi.spyOn(map.painter, 'clearBackgroundTiles');

            await waitFor(map, "load");
            // Defaults to style projection
            expect(style.serialize().projection.name).toEqual('albers');
            expect(map.transform.getProjection().name).toEqual('albers');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(1);

            // Runtime api overrides style projection
            // Stylesheet projection not changed by runtime apis
            map.setProjection({name: 'winkelTripel'});
            expect(style.serialize().projection.name).toEqual('albers');
            expect(map.transform.getProjection().name).toEqual('winkelTripel');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(2);

            // Runtime api overrides stylesheet projection
            style.setState(Object.assign({}, style.serialize(), {projection: {name: 'naturalEarth'}}));
            expect(style.serialize().projection.name).toEqual('naturalEarth');
            expect(map.transform.getProjection().name).toEqual('winkelTripel');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(2);

            // Unsetting runtime projection reveals stylesheet projection
            map.setProjection(null);
            expect(style.serialize().projection.name).toEqual('naturalEarth');
            expect(map.transform.getProjection().name).toEqual('naturalEarth');
            expect(map.getProjection().name).toEqual('naturalEarth');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(3);

            // Unsetting stylesheet projection reveals mercator
            const stylesheet = style.serialize();
            delete stylesheet.projection;
            style.setState(stylesheet);
            expect(style.serialize().projection).toEqual(undefined);
            expect(map.transform.getProjection().name).toEqual('mercator');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(4);
        });

        test('setProjection(null) reveals globe when in style', async () => {
            const map = createMap({style: {
                "version": 8,
                "projection": {
                    "name": "globe"
                },
                "sources": {},
                "layers": []
            }});
            const style = map.style;

            vi.spyOn(map.painter, 'clearBackgroundTiles');

            await waitFor(map, "load");
            // Defaults to style projection
            expect(style.serialize().projection.name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual('globe');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(1);

            // Runtime api overrides stylesheet projection
            map.setProjection('albers');
            expect(style.serialize().projection.name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual('albers');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(2);

            // Unsetting runtime projection reveals stylesheet projection
            map.setProjection(null);
            expect(style.serialize().projection.name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual('globe');
            expect(map.getProjection().name).toEqual('globe');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(3);
        });
    });

    describe('#setProjection', () => {
        test('sets projection by string', () => {
            const map = createMap();
            map.setProjection('albers');
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
        });

        /**
         * @note Original test was broken.
         * @todo Add assertion before render actually happening
         * @see https://github.com/mapbox/mapbox-gl-js-internal/blob/internal/test/unit/ui/map.test.js#L2406
         */
        test.skip('throws error if invalid projection name is supplied', () => {
            expect(() => {
                return createMap({
                    projection: 'fakeProj',
                });
            }).toThrowError('Invalid projection name: fakeProj');
        });

        test('sets projection by options object', () => {
            const options = {
                name: 'albers',
                center: [12, 34],
                parallels: [10, 42]
            };
            const map = createMap();
            map.setProjection(options);
            expect(map.getProjection()).toEqual(options);
        });

        test('sets projection by options object with just name', () => {
            const map = createMap();
            map.setProjection({name: 'albers'});
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
        });

        test('setProjection with no argument defaults to Mercator', () => {
            const map = createMap();
            map.setProjection({name: 'albers'});
            expect(map.getProjection().name).toEqual('albers');
            map.setProjection();
            expect(map.getProjection()).toEqual({name: 'mercator', center: [0, 0]});
        });

        test('setProjection(null) defaults to Mercator', () => {
            const map = createMap();
            map.setProjection({name: 'albers'});
            expect(map.getProjection().name).toEqual('albers');
            map.setProjection(null);
            expect(map.getProjection()).toEqual({name: 'mercator', center: [0, 0]});
        });

        test('setProjection persists after new style', async () => {
            const map = createMap();
            await waitFor(map, "style.load");
            map.setProjection({name: 'albers'});
            expect(map.getProjection().name).toEqual('albers');

            // setStyle with diffing
            map.setStyle(Object.assign({}, map.getStyle(), {projection: {name: 'winkelTripel'}}));
            expect(map.getProjection().name).toEqual('albers');
            expect(map.style.stylesheet.projection.name).toEqual('winkelTripel');

            map.setProjection({name: 'globe'});
            expect(map.getProjection().name).toEqual('globe');
            expect(map.style.stylesheet.projection.name).toEqual('winkelTripel');
            map.setProjection({name: 'lambertConformalConic'});

            // setStyle without diffing
            const s = map.getStyle();
            delete s.projection;
            map.setStyle(s, {diff: false});
            await waitFor(map, "style.load");
            expect(map.getProjection().name).toEqual('lambertConformalConic');
            expect(map.style.stylesheet.projection).toEqual(undefined);
        });
    });

    describe('#project', () => {
        let map;

        beforeEach(() => {
            map = createMap();
        });

        test('In Mercator', () => {
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng: -70.3125, lat: 57.326521225}))).toEqual({x: "0.00000000", y: "0.00000000"});
        });
        test('In Globe', () => {
            map.setProjection('globe');
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng:  -72.817409474, lat: 43.692434709}))).toEqual({x: "38.86205343", y: "38.86205343"});
        });
        test('In Natural Earth', () => {
            map.setProjection('naturalEarth');
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng: -86.861020716, lat: 61.500721712}))).toEqual({x: "0.00000000", y: "-0.00000000"});
        });
        test('In Albers', () => {
            map.setProjection('albers');
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng: 44.605340721, lat: 79.981951054}))).toEqual({x: "-0.00000000", y: "-0.00000000"});
        });
    });

    describe('#unproject', () => {
        let map;

        beforeEach(() => {
            map = createMap();
        });

        test('In Mercator', () => {
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: -0, lat: 0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: -70.3125, lat: 57.326521225});
        });
        test('In Globe', () => {
            map.setProjection('globe');
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: -0, lat: 0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: -67.77848443, lat: 42.791315106});
        });
        test('In Natural Earth', () => {
            map.setProjection('naturalEarth');
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: -0, lat: 0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: -86.861020716, lat: 61.500721712});
        });
        test('In Albers', () => {
            map.setProjection('albers');
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: 0, lat: -0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: 44.605340721, lat: 79.981951054});
        });
    });

});
