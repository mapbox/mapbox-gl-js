import {describe, test, expect} from "../../util/vitest.js";
import LngLat from '../../../src/geo/lng_lat.js';
import MercatorCoordinate, {mercatorScale} from '../../../src/geo/mercator_coordinate.js';

describe('LngLat', () => {
    test('#constructor', () => {
        expect(new MercatorCoordinate(0, 0) instanceof MercatorCoordinate).toBeTruthy();
        expect(new MercatorCoordinate(0, 0, 0) instanceof MercatorCoordinate).toBeTruthy();
    });

    test('#fromLngLat', () => {
        const nullIsland = new LngLat(0, 0);
        expect(MercatorCoordinate.fromLngLat(nullIsland)).toEqual({x: 0.5, y: 0.5, z: 0});
    });

    test('#toLngLat', () => {
        const dc = new LngLat(-77, 39);
        expect(MercatorCoordinate.fromLngLat(dc, 500).toLngLat()).toEqual({lng: -77, lat: 39});
    });

    test('#toAltitude', () => {
        const dc = new LngLat(-77, 39);
        expect(MercatorCoordinate.fromLngLat(dc, 500).toAltitude()).toEqual(500);
    });

    test('#mercatorScale', () => {
        expect(mercatorScale(0)).toEqual(1);
        expect(mercatorScale(45)).toEqual(1.414213562373095);
    });

    test('#meterInMercatorCoordinateUnits', () => {
        const nullIsland = new LngLat(0, 0);
        expect(MercatorCoordinate.fromLngLat(nullIsland).meterInMercatorCoordinateUnits()).toEqual(2.4981121214570498e-8);
    });
});
