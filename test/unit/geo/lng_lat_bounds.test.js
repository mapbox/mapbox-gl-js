import {describe, test, expect} from "../../util/vitest.js";
import LngLat, {LngLatBounds} from '../../../src/geo/lng_lat.js';

describe('LngLatBounds', () => {
    test('#constructor', () => {
        const sw = new LngLat(0, 0);
        const ne = new LngLat(-10, 10);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getSouth()).toEqual(0);
        expect(bounds.getWest()).toEqual(0);
        expect(bounds.getNorth()).toEqual(10);
        expect(bounds.getEast()).toEqual(-10);
    });

    test('#constructor across dateline', () => {
        const sw = new LngLat(170, 0);
        const ne = new LngLat(-170, 10);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getSouth()).toEqual(0);
        expect(bounds.getWest()).toEqual(170);
        expect(bounds.getNorth()).toEqual(10);
        expect(bounds.getEast()).toEqual(-170);
    });

    test('#constructor across pole', () => {
        const sw = new LngLat(0, 85);
        const ne = new LngLat(-10, -85);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getSouth()).toEqual(85);
        expect(bounds.getWest()).toEqual(0);
        expect(bounds.getNorth()).toEqual(-85);
        expect(bounds.getEast()).toEqual(-10);
    });

    test('#constructor no args', () => {
        const bounds = new LngLatBounds();
        expect(() => {
            bounds.getCenter();
        }).toThrowError();
    });

    test('#extend with coordinate', () => {
        const bounds = new LngLatBounds([0, 0], [10, 10]);
        bounds.extend([-10, -10]);

        expect(bounds.getSouth()).toEqual(-10);
        expect(bounds.getWest()).toEqual(-10);
        expect(bounds.getNorth()).toEqual(10);
        expect(bounds.getEast()).toEqual(10);

        bounds.extend(new LngLat(-15, -15));

        expect(bounds.getSouth()).toEqual(-15);
        expect(bounds.getWest()).toEqual(-15);
        expect(bounds.getNorth()).toEqual(10);
        expect(bounds.getEast()).toEqual(10);

        bounds.extend([-20, -20, 100]);

        expect(bounds.getSouth()).toEqual(-20);
        expect(bounds.getWest()).toEqual(-20);
        expect(bounds.getNorth()).toEqual(10);
        expect(bounds.getEast()).toEqual(10);
    });

    test('#extend with bounds', () => {
        const bounds1 = new LngLatBounds([0, 0], [10, 10]);
        const bounds2 = new LngLatBounds([-10, -10], [10, 10]);

        bounds1.extend(bounds2);

        expect(bounds1.getSouth()).toEqual(-10);
        expect(bounds1.getWest()).toEqual(-10);
        expect(bounds1.getNorth()).toEqual(10);
        expect(bounds1.getEast()).toEqual(10);

        const bounds3 = [[-15, -15], [15, 15]];
        bounds1.extend(bounds3);

        expect(bounds1.getSouth()).toEqual(-15);
        expect(bounds1.getWest()).toEqual(-15);
        expect(bounds1.getNorth()).toEqual(15);
        expect(bounds1.getEast()).toEqual(15);

        const bounds4 = new LngLatBounds([-20, -20, 20, 20]);
        bounds1.extend(bounds4);

        expect(bounds1.getSouth()).toEqual(-20);
        expect(bounds1.getWest()).toEqual(-20);
        expect(bounds1.getNorth()).toEqual(20);
        expect(bounds1.getEast()).toEqual(20);
    });

    test('#extend with literal object LngLat', () => {
        const bounds1 = new LngLatBounds([0, 0], [10, 10]);
        const bounds2 = {lon: -10, lat: -10};

        bounds1.extend(bounds2);

        expect(bounds1.getSouth()).toEqual(-10);
        expect(bounds1.getWest()).toEqual(-10);
        expect(bounds1.getNorth()).toEqual(10);
        expect(bounds1.getEast()).toEqual(10);
    });

    test('#extend with literal object LngLat', () => {
        const bounds1 = new LngLatBounds([0, 0], [10, 10]);
        const bounds2 = {lng: -10, lat: -10};

        bounds1.extend(bounds2);

        expect(bounds1.getSouth()).toEqual(-10);
        expect(bounds1.getWest()).toEqual(-10);
        expect(bounds1.getNorth()).toEqual(10);
        expect(bounds1.getEast()).toEqual(10);
    });

    test('#extend with null', () => {
        const bounds = new LngLatBounds([0, 0], [10, 10]);

        bounds.extend(null);

        expect(bounds.getSouth()).toEqual(0);
        expect(bounds.getWest()).toEqual(0);
        expect(bounds.getNorth()).toEqual(10);
        expect(bounds.getEast()).toEqual(10);
    });

    test('#extend undefined bounding box', () => {
        const bounds1 = new LngLatBounds(undefined, undefined);
        const bounds2 = new LngLatBounds([-10, -10], [10, 10]);

        bounds1.extend(bounds2);

        expect(bounds1.getSouth()).toEqual(-10);
        expect(bounds1.getWest()).toEqual(-10);
        expect(bounds1.getNorth()).toEqual(10);
        expect(bounds1.getEast()).toEqual(10);
    });

    test('#extend same LngLat instance', () => {
        const point = new LngLat(0, 0);
        const bounds = new LngLatBounds(point, point);

        bounds.extend(new LngLat(15, 15));

        expect(bounds.getSouth()).toEqual(0);
        expect(bounds.getWest()).toEqual(0);
        expect(bounds.getNorth()).toEqual(15);
        expect(bounds.getEast()).toEqual(15);
    });

    test('#extend with empty array', () => {
        const point = new LngLat(0, 0);
        const bounds = new LngLatBounds(point, point);

        expect(() => {
            bounds.extend([]);
        }).toThrowError(
            "`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, an object {lon: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]"
        );
    });

    test('accessors', () => {
        const sw = new LngLat(0, 0);
        const ne = new LngLat(-10, -20);
        const bounds = new LngLatBounds(sw, ne);
        expect(bounds.getCenter()).toEqual(new LngLat(-5, -10));
        expect(bounds.getSouth()).toEqual(0);
        expect(bounds.getWest()).toEqual(0);
        expect(bounds.getNorth()).toEqual(-20);
        expect(bounds.getEast()).toEqual(-10);
        expect(bounds.getSouthWest()).toEqual(new LngLat(0, 0));
        expect(bounds.getSouthEast()).toEqual(new LngLat(-10, 0));
        expect(bounds.getNorthEast()).toEqual(new LngLat(-10, -20));
        expect(bounds.getNorthWest()).toEqual(new LngLat(0, -20));
    });

    test('#convert', () => {
        const sw = new LngLat(0, 0);
        const ne = new LngLat(-10, 10);
        const bounds = new LngLatBounds(sw, ne);
        expect(LngLatBounds.convert(undefined)).toEqual(undefined);
        expect(LngLatBounds.convert(bounds)).toEqual(bounds);
        expect(LngLatBounds.convert([sw, ne])).toEqual(bounds);
        expect(
            LngLatBounds.convert([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()])
        ).toEqual(bounds);
    });

    test('#toArray', () => {
        const llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
        expect(llb.toArray()).toEqual([[-73.9876, 40.7661], [-73.9397, 40.8002]]);
    });

    test('#toString', () => {
        const llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
        expect(llb.toString()).toEqual('LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))');
    });

    test('#isEmpty', () => {
        const nullBounds = new LngLatBounds();
        expect(nullBounds.isEmpty()).toEqual(true);
        nullBounds.extend([-73.9876, 40.7661], [-73.9397, 40.8002]);
        expect(nullBounds.isEmpty()).toEqual(false);
    });

    describe('contains', () => {
        describe('point', () => {
            test('point is in bounds', () => {
                const llb = new LngLatBounds([-1, -1], [1, 1]);
                const ll = {lng: 0, lat: 0};
                expect(llb.contains(ll)).toBeTruthy();
            });

            test('point is not in bounds', () => {
                const llb = new LngLatBounds([-1, -1], [1, 1]);
                const ll = {lng: 3, lat: 3};
                expect(llb.contains(ll)).toBeFalsy();
            });

            test('point is in bounds that spans dateline', () => {
                const llb = new LngLatBounds([190, -10], [170, 10]);
                const ll = {lng: 180, lat: 0};
                expect(llb.contains(ll)).toBeTruthy();
            });

            test('point is not in bounds that spans dateline', () => {
                const llb = new LngLatBounds([190, -10], [170, 10]);
                const ll = {lng: 0, lat: 0};
                expect(llb.contains(ll)).toBeFalsy();
            });
        });
    });
});
