var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();
var getRanges = require('../js/text/ranges');

suite.add('text/ranges', function() {
    getRanges([
        { 'name': 'Pennsylvania Ave NW DC' },
        { 'name': 'Baker St' },
        {},
        { 'name': '14 St NW' }
    ], {
        'text-field': 'name'
    });
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();
