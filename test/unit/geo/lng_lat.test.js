import {test} from '../../util/test';
import LngLat from '../../../src/geo/lng_lat';

test('LngLat', (t) => {
    t.test('#constructor', (t) => {
        t.ok(new LngLat(0, 0) instanceof LngLat, 'creates an object');
        t.throws(() => {
            /*eslint no-new: 0*/
            new LngLat('foo', 0);
        }, "Invalid LngLat object: (foo, 0)", 'detects and throws on invalid input');
        t.throws(() => {
            /*eslint no-new: 0*/
            new LngLat(0, -91);
        }, 'Invalid LngLat latitude value: must be between -90 and 90', 'detects and throws on invalid input');
        t.throws(() => {
            /*eslint no-new: 0*/
            new LngLat(0, 91);
        }, 'Invalid LngLat latitude value: must be between -90 and 90', 'detects and throws on invalid input');
        t.end();
    });

    t.test('#convert', (t) => {
        t.ok(LngLat.convert([0, 10]) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert([0, 10, 0]) instanceof LngLat, 'convert creates a LngLat instance (Elevation)');
        t.throw(() => {
            LngLat.convert([0, 10, 0, 5]);
        }, "LngLat must not accept an array size bigger than 3'", 'detects and throws on invalid input');
        t.ok(LngLat.convert({lng: 0, lat: 10}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert({lng: 0, lat: 0}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert({lng: 0, lat: 0, elev: 0}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert({lon: 0, lat: 10}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert({lon: 0, lat: 0}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert({lon: 0, lat: 0, elev: 0}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert(new LngLat(0, 0)) instanceof LngLat, 'convert creates a LngLat instance');
        t.throws(() => {
            LngLat.convert(0, 10);
        }, "`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, an object {lon: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]", 'detects and throws on invalid input');
        t.end();
    });

    t.test('#wrap', (t) => {
        t.deepEqual(new LngLat(0, 0).wrap(), {lng: 0, lat: 0});
        t.deepEqual(new LngLat(10, 20).wrap(), {lng: 10, lat: 20});
        t.deepEqual(new LngLat(360, 0).wrap(), {lng: 0, lat: 0});
        t.deepEqual(new LngLat(190, 0).wrap(), {lng: -170, lat: 0});
        t.end();
    });

    t.test('#toArray', (t) => {
        t.deepEqual(new LngLat(10, 20).toArray(), [10, 20]);
        t.end();
    });

    t.test('#toString', (t) => {
        t.equal(new LngLat(10, 20).toString(), 'LngLat(10, 20)');
        t.end();
    });

    t.test('#distanceTo', (t) => {
        const newYork = new LngLat(-74.0060, 40.7128);
        const losAngeles = new LngLat(-118.2437, 34.0522);
        const d = newYork.distanceTo(losAngeles); // 3935751.690893987, "true distance" is 3966km
        t.ok(d > 3935750, "New York should be more than 3935750m from Los Angeles");
        t.ok(d < 3935752, "New York should be less than 3935752m from Los Angeles");
        t.end();
    });

    t.test('#distanceTo to pole', (t) => {
        const newYork = new LngLat(-74.0060, 40.7128);
        const northPole = new LngLat(-135, 90);
        const d = newYork.distanceTo(northPole); // 5480494.158486183 , "true distance" is 5499km
        t.ok(d > 5480493, "New York should be more than 5480493m from the North Pole");
        t.ok(d < 5480495, "New York should be less than 5480495m from the North Pole");
        t.end();
    });

    t.test('#distanceTo to Null Island', (t) => {
        const newYork = new LngLat(-74.0060, 40.7128);
        const nullIsland = new LngLat(0, 0);
        const d = newYork.distanceTo(nullIsland); // 8667080.125666846 , "true distance" is 8661km
        t.ok(d > 8667079, "New York should be more than 8667079m from Null Island");
        t.ok(d < 8667081, "New York should be less than 8667081m from Null Island");
        t.end();
    });

    t.test('#toBounds', (t) => {
        t.deepEqual(new LngLat(0, 0).toBounds(10).toArray(), [[-0.00008983152770714982, -0.00008983152770714982], [0.00008983152770714982, 0.00008983152770714982]]);
        t.deepEqual(new LngLat(-73.9749, 40.7736).toBounds(10).toArray(), [[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]);
        t.deepEqual(new LngLat(-73.9749, 40.7736).toBounds().toArray(), [[-73.9749, 40.7736], [-73.9749, 40.7736]]);
        t.end();
    });

    t.end();
});
