'use strict';

const util = require('../util/util');
const interpolate = require('../util/interpolate');

const fakeZoomHistory = { lastIntegerZoom: 0, lastIntegerZoomTime: 0, lastZoom: 0 };

/*
 * Represents a transition between two declarations
 */
class StyleTransition {

    constructor(reference, declaration, oldTransition, options, zoomHistory) {
        this.declaration = declaration;
        this.startTime = this.endTime = (new Date()).getTime();

        this.oldTransition = oldTransition;
        this.duration = options.duration || 0;
        this.delay = options.delay || 0;

        this.zoomTransitioned = reference.function === 'piecewise-constant' && reference.transition;
        this.interp = this.zoomTransitioned ? interpZoomTransitioned : interpolate[reference.type];
        this.zoomHistory = zoomHistory || fakeZoomHistory;

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
     * Return the value of the transitioning property.
     */
    calculate(globalProperties, featureProperties, time) {
        const value = this._calculateTargetValue(globalProperties, featureProperties);

        if (this.instant())
            return value;

        time = time || Date.now();

        if (time >= this.endTime)
            return value;

        const oldValue = this.oldTransition.calculate(globalProperties, featureProperties, this.startTime);
        const t = util.easeCubicInOut((time - this.startTime - this.delay) / this.duration);
        return this.interp(oldValue, value, t);
    }

    _calculateTargetValue(globalProperties, featureProperties) {
        if (!this.zoomTransitioned)
            return this.declaration.calculate(globalProperties, featureProperties);

        // calculate zoom transition between discrete values, such as images and dasharrays.
        const z = globalProperties.zoom;
        const lastIntegerZoom = this.zoomHistory.lastIntegerZoom;

        const fromScale = z > lastIntegerZoom ? 2 : 0.5;
        const from = this.declaration.calculate({zoom: z > lastIntegerZoom ? z - 1 : z + 1}, featureProperties);
        const to = this.declaration.calculate({zoom: z}, featureProperties);

        const timeFraction = Math.min((Date.now() - this.zoomHistory.lastIntegerZoomTime) / this.duration, 1);
        const zoomFraction = Math.abs(z - lastIntegerZoom);
        const t = interpolate(timeFraction, 1, zoomFraction);

        if (from === undefined || to === undefined)
            return undefined;

        return { from, fromScale, to, toScale: 1, t };
    }
}

module.exports = StyleTransition;

// interpolate between two values that transition with zoom, such as images and dasharrays
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
