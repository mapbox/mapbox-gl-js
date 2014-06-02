var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();
var getRanges = require('../js/text/ranges');

function mockFeature(obj) {
    obj.loadGeometry = function() { return {}; };
    return obj;
}

suite.add('text/ranges', function() {
    getRanges([
        mockFeature({ 'name': 'Pennsylvania Ave NW DC' }),
        mockFeature({ 'name': 'Baker St' }),
        mockFeature({}),
        mockFeature({ 'name': '14 St NW' })
    ], {
        'text-field': 'name'
    });
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();
