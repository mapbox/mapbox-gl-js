var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();
var shaping = require('../js/text/shaping');

suite.add('text/shaping', function() {
    var oneEm = 24;
    var name = 'Arial';
    var stacks = { 'Arial': { glyphs: {
        32: { advance:20 },
        97: { advance:20 },
        98: { advance:20 },
        99: { advance:20 },
        100: { advance:20 },
        101: { advance:20 }
    }}};
    shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0 * oneEm);
    shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0.125 * oneEm);
    shaping.shape('abcde abcde', name, stacks, 4 * oneEm, oneEm, 0.5, 0 * oneEm);
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();
