var chroma = require('./lib/chroma.js');
var util = require('./util.js');

module.exports = StyleTransition;

function StyleTransition(name, value, constants) {
    console.log(name, this.interpolators, this.interpolators[name]);
    this.interp = this.interpolators[name];
    if (!this.interp) return;
    this.duration = value[0];
    this.delay = value[1];
    this.ease = util.easeCubicInOut;
}

var interpNumber = util.interp;

StyleTransition.prototype.interpolators = {
    opacity: interpNumber,

    color: interpColor,
    stroke: interpColor,

    width: interpNumber,
    offset: interpNumber,

    dasharray: interpNumberArray,
};

function interpNumberArray(from, to, t) {
    return from.map(function(d, i) {
        return interpNumber(d, to[i], t);
    });
}

function interpColor(from, to, t) {
    throw('todo');
}
