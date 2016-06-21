'use strict';

var util = require('../util/util');
var interpolate = require('../util/interpolate');

module.exports = StyleTransition;

/*
 * Represents a transition between two declarations
 */
function StyleTransition(reference, declaration, oldTransition, value) {

    this.declaration = declaration;
    this.startTime = this.endTime = (new Date()).getTime();

    if (reference.function === 'piecewise-constant' && reference.transition) {
        this.interp = interpZoomTransitioned;
    } else {
        this.interp = interpolate[reference.type];
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
StyleTransition.prototype.calculate = function(globalProperties, featureProperties) {
    var value = this.declaration.calculate(
        util.extend({}, globalProperties, {duration: this.duration}),
        featureProperties
    );

    if (this.instant()) return value;

    var t = globalProperties.time || Date.now();

    if (t < this.endTime) {
        var oldValue = this.oldTransition.calculate(
            util.extend({}, globalProperties, {time: this.startTime}),
            featureProperties
        );
        var eased = this.ease((t - this.startTime - this.delay) / this.duration);
        value = this.interp(oldValue, value, eased);
    }

    return value;

};

// This function is used to smoothly transition between discrete values, such
// as images and dasharrays.
function interpZoomTransitioned(from, to, t) {
    if ((from && from.to) === undefined || (to && to.to) === undefined) {
        return undefined;
    } else {
        return {
            from: from.to,
            fromScale: from.toScale,
            to: to.to,
            toScale: to.toScale,
            t: t
        };
    }
}
