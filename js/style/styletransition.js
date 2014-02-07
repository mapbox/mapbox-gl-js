'use strict';

var util = require('../util/util.js');

module.exports = StyleTransition;

/*
 * Represents a transition between two declarations
 */
function StyleTransition(declaration, oldTransition, value) {

    this.declaration = declaration;
    this.interp = this.interpolators[declaration.prop];
    this.startTime = this.endTime = (new Date()).getTime();

    var instant = !oldTransition ||
        !this.interp ||
        !value ||
        (value.duration === 0 && value.delay === 0);

    if (!instant) {
        this.endTime = this.startTime + (value.duration || 0) + (value.delay || 0);

        this.duration = value.duration;
        this.delay = value.delay;
        this.ease = util.easeCubicInOut;
        this.oldTransition = oldTransition;

    }

    if (oldTransition && oldTransition.endTime <= this.startTime) {
        // Old transition is done running, so we can
        // delete its reference to its old transition.

        delete oldTransition.oldTransition;
    }

}

/*
 * Return the value of the transitioning property at zoom level `z` and optional time `t`
 */
StyleTransition.prototype.at = function(z, t) {

    if (typeof t === 'undefined') t = (new Date()).getTime();

    var calculatedValue = this.declaration.calculate(z, t);

    if (t < this.endTime) {
        var oldCalculatedValue = this.oldTransition.at(z, this.startTime);
        var eased = this.ease((t - this.startTime - this.delay) / this.duration);
        calculatedValue = this.interp(oldCalculatedValue, calculatedValue, eased);
    }

    return calculatedValue;

};

var interpNumber = util.interp;

StyleTransition.prototype.interpolators = {
    opacity: interpNumber,

    color: interpColor,
    stroke: interpColor,

    width: interpNumber,
    offset: interpNumber,
    'fade-dist': interpNumber,

    dasharray: interpNumberArray,

    brightness_low: interpNumber,
    brightness_high: interpNumber,
    saturation: interpNumber
};

function interpNumberArray(from, to, t) {
    return from.map(function(d, i) {
        return interpNumber(d, to[i], t);
    });
}

function interpColor(from, to, t) {
    return [
        interpNumber(from[0], to[0], t),
        interpNumber(from[1], to[1], t),
        interpNumber(from[2], to[2], t),
        interpNumber(from[3], to[3], t)
    ];
}
