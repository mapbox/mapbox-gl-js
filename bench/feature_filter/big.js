'use strict';

var filter = require('../../').featureFilter;

var N = 64000;

var arr = ['in', 'foo'];
for (var i = 0; i < N; i++) arr.push(i);

console.time('create ' + N + '-item filter');
var f = filter(arr);
console.timeEnd('create ' + N + '-item filter');

var feature = {properties: {foo: 0}};

console.time('filter 1 million times');
for (var i = 0; i < 1000000; i++) {
    feature.properties.foo = Math.floor(Math.random() * N * 2);
    f(feature);
}
console.timeEnd('filter 1 million times');
