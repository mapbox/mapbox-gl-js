var Benchmark = require('benchmark'),
	suite = new Benchmark.Suite();

var Style = require('../../js/style/style'),
	AnimationLoop = require('../../js/style/animationloop');

var sampleStyle = require('../../debug/style.json');

var style = new Style(sampleStyle, new AnimationLoop());

suite.add('style/recalculate', function() {
	style.recalculate(Math.random() * 20);

}).on('cycle', function(event) {
    console.log(String(event.target));
}).run();
