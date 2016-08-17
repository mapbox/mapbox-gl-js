'use strict';

var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();

var Transform = require('../../js/geo/transform');
var LngLat = require('../../js/geo/lng_lat.js');
var Point = require('point-geometry');

var t = new Transform();
t.resize(512, 512);
t.zoom = 12;
t.center = new LngLat(30.5, 50.5);

suite
.add('locationPoint', function() {
    var lnglat = new LngLat(30 + Math.random(), 50 + Math.random());
    t.locationPoint(lnglat);
})
.add('pointLocation', function() {
    var point = new Point(1000 * Math.random(), 1000 * Math.random());
    t.pointLocation(point);
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();
