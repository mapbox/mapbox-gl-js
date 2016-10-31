'use strict';

const util = require('../util/util');
const interpolate = require('../util/interpolate');

/*
 * Represents a transition between two declarations
 */
class StyleTransition {

    constructor(reference, declaration, oldTransition, options) {
        this.declaration = declaration;
        this.startTime = this.endTime = (new Date()).getTime();

        this.oldTransition = oldTransition;
        this.duration = options.duration || 0;
        this.delay = options.delay || 0;

        this.zoomTransitioned = reference.function === 'piecewise-constant' && reference.transition;
        this.interp = this.zoomTransitioned ? interpZoomTransitioned : interpolate[reference.type];

        if (!this.instant()) {
            this.endTime = this.startTime + this.duration + this.delay;
        }

        if (oldTransition && oldTransition.endTime <= this.startTime) {
            // Old transition is done running, so we can
            // delete its reference to its old transition.
            delete oldTransition.oldTransition;
        }
    }

    instant() {
        return !this.oldTransition || !this.interp || (this.duration === 0 && this.delay === 0);
    }

    /*
     * Return the value of the transitioning property at zoom level `z` and optional time `t`
     */
    calculate(globalProperties, featureProperties, time) {
        let value;
        if (this.zoomTransitioned) {
            value = this._calculateZoomTransitioned(globalProperties, featureProperties);
        } else {
            value = this.declaration.calculate(globalProperties, featureProperties);
        }

        if (this.instant())
            return value;

        time = time || Date.now();

        if (time >= this.endTime)
            return value;

        const oldValue = this.oldTransition.calculate(globalProperties, featureProperties, this.startTime);
        const t = util.easeCubicInOut((time - this.startTime - this.delay) / this.duration);
        return this.interp(oldValue, value, t);
    }

    // This function is used to smoothly transition between discrete values, such
    // as images and dasharrays.
    _calculateZoomTransitioned(globalProperties, featureProperties) {
        const z = globalProperties.zoom;
        const zh = globalProperties.zoomHistory;

        const fromScale = z > zh.lastIntegerZoom ? 2 : 0.5;
        const from = this.declaration.calculate({zoom: z > zh.lastIntegerZoom ? z - 1 : z + 1}, featureProperties);
        const to = this.declaration.calculate({zoom: z}, featureProperties);

        const timeFraction = Math.min((Date.now() - zh.lastIntegerZoomTime) / this.duration, 1);
        const zoomFraction = Math.abs(z - zh.lastIntegerZoom);
        const t = interpolate(timeFraction, 1, zoomFraction);

        if (from === undefined || to === undefined)
            return undefined;

        return { from, fromScale, to, toScale: 1, t };
    }
}

module.exports = StyleTransition;

// This function is used to smoothly transition between discrete values, such
// as images and dasharrays.
function interpZoomTransitioned(from, to, t) {
    if (from === undefined || to === undefined)
        return undefined;

    return {
        from: from.to,
        fromScale: from.toScale,
        to: to.to,
        toScale: to.toScale,
        t: t
    };
}
