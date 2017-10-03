
const filter = require('../../../src/style-spec').featureFilter;

const N = 64000;

const arr = ['in', 'foo'];
for (let i = 0; i < N; i++) arr.push(i);

console.time(`create ${N}-item filter`);
const f = filter(arr);
console.timeEnd(`create ${N}-item filter`);

const feature = {properties: {foo: 0}};

console.time('filter 1 million times');
for (let i = 0; i < 1000000; i++) {
    feature.properties.foo = Math.floor(Math.random() * N * 2);
    f(feature);
}
console.timeEnd('filter 1 million times');
