'use strict';

var util = require('../util/util.js');

module.exports = StyleTransition;

/*
 * Represents a transition between two declarations
 */
function StyleTransition(declaration, oldTransition, value) {

    this.declaration = declaration;
    this.startTime = this.endTime = (new Date()).getTime();

    var type = declaration.type;
    if (type === 'number') {
        this.interp = util.interp;
    } else if (type === 'color') {
        this.interp = interpColor;
    } else if (type === 'array') {
        this.interp = interpNumberArray;
    }

    this.oldTransition = oldTransition;
    this.duration = value.duration || 0;
    this.delay = value.delay || 0;

    if (!this.instant()) {
        this.endTime = this.startTime + this.duration + this.delay;
        this.ease = util.easeCubicInOut;
    }

    if (oldTransition && oldTransition.endTime <= this.startTime) {
        // Old transition is done running, so we can
        // delete its reference to its old transition.

        delete oldTransition.oldTransition;
    }
}

StyleTransition.prototype.instant = function() {
    return !this.oldTransition || !this.interp || (this.duration === 0 && this.delay === 0);
};

/*
 * Return the value of the transitioning property at zoom level `z` and optional time `t`
 */
StyleTransition.prototype.at = function(z, t) {

    var value = this.declaration.calculate(z);

    if (this.instant()) return value;

    t = t || Date.now();

    if (t < this.endTime) {
        var oldValue = this.oldTransition.at(z, this.startTime);
        var eased = this.ease((t - this.startTime - this.delay) / this.duration);
        value = this.interp(oldValue, value, eased);
    }

    return value;

};

function interpNumberArray(from, to, t) {
    return from.map(function(d, i) {
        return util.interp(d, to[i], t);
    });
}

function interpColor(from, to, t) {
    return [
        util.interp(from[0], to[0], t),
        util.interp(from[1], to[1], t),
        util.interp(from[2], to[2], t),
        util.interp(from[3], to[3], t)
    ];
}
