var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();

var Style = require('../../js/style/style'),
	AnimationLoop = require('../../js/style/animationloop');

var sampleStyle = require('../../debug/style.json');

suite.add('style/parse', function() {
	var style = new Style(sampleStyle, new AnimationLoop());

}).on('cycle', function(event) {
    console.log(String(event.target));
}).run();
