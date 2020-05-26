import {test} from '../../util/test';
import LngLat from '../../../src/geo/lng_lat';
import MercatorCoordinate, {mercatorScale} from '../../../src/geo/mercator_coordinate';

test('LngLat', (t) => {
    t.test('#constructor', (t) => {
        t.ok(new MercatorCoordinate(0, 0) instanceof MercatorCoordinate, 'creates an object');
        t.ok(new MercatorCoordinate(0, 0, 0) instanceof MercatorCoordinate, 'creates an object with altitude');
        t.end();
    });

    t.test('#fromLngLat', (t) => {
        const nullIsland = new LngLat(0, 0);
        t.deepEqual(MercatorCoordinate.fromLngLat(nullIsland), {x: 0.5, y: 0.5, z: 0});
        t.end();
    });

    t.test('#toLngLat', (t) => {
        const dc = new LngLat(-77, 39);
        t.deepEqual(MercatorCoordinate.fromLngLat(dc, 500).toLngLat(), {lng: -77, lat: 39});
        t.end();
    });

    t.test('#toAltitude', (t) => {
        const dc = new LngLat(-77, 39);
        t.equal(MercatorCoordinate.fromLngLat(dc, 500).toAltitude(), 500);
        t.end();
    });

    t.test('#mercatorScale', (t) => {
        t.equal(mercatorScale(0), 1, 'mercator scale at the equator');
        t.equal(mercatorScale(45), 1.414213562373095, 'mercator scale at 45 degrees latitude');
        t.end();
    });

    t.test('#meterInMercatorCoordinateUnits', (t) => {
        const nullIsland = new LngLat(0, 0);
        t.equal(MercatorCoordinate.fromLngLat(nullIsland).meterInMercatorCoordinateUnits(), 2.4981121214570498e-8, 'length of 1 meter in MercatorCoordinate units at the equator');
        t.end();
    });

    t.end();
});
