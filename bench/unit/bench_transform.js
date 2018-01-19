
const Benchmark = require('benchmark');
const suite = new Benchmark.Suite();

const Transform = require('../../src/geo/transform');
const LngLat = require('../../src/geo/lng_lat.js');
const Point = require('point-geometry');

const t = new Transform();
t.resize(512, 512);
t.zoom = 12;
t.center = new LngLat(30.5, 50.5);

suite.add('locationPoint', () => {
    const lnglat = new LngLat(30 + Math.random(), 50 + Math.random());
    t.locationPoint(lnglat);

}).add('pointLocation', () => {
    const point = new Point(1000 * Math.random(), 1000 * Math.random());
    t.pointLocation(point);

}).on('cycle', (event) => {
    console.log(String(event.target));

}).run();
