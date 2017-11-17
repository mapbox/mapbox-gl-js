// @flow

const util = require('../util/util');
const interpolate = require('../style-spec/util/interpolate');

import type StyleDeclaration from './style_declaration';
import type {Feature, GlobalProperties} from '../style-spec/expression';

const fakeZoomHistory = { lastIntegerZoom: 0, lastIntegerZoomTime: 0, lastZoom: 0 };

/*
 * Represents a transition between two declarations
 */
class StyleTransition {
    declaration: StyleDeclaration;
    startTime: number;
    endTime: number;
    oldTransition: ?StyleTransition;
    duration: number;
    delay: number;
    zoomTransitioned: boolean;
    interp: Function;
    zoomHistory: any;
    loopID: any;

    constructor(reference: any,
                declaration: StyleDeclaration,
                oldTransition: ?StyleTransition,
                options: TransitionSpecification,
                zoomHistory?: {}) {
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
    calculate(globals: GlobalProperties, feature?: Feature, time?: number) {
        const value = this._calculateTargetValue(globals, feature);

        if (this.instant())
            return value;

        time = time || Date.now();

        if (time >= this.endTime)
            return value;

        const oldValue = (this.oldTransition: any).calculate(globals, feature, this.startTime);
        const t = util.easeCubicInOut((time - this.startTime - this.delay) / this.duration);
        return this.interp(oldValue, value, t);
    }

    _calculateTargetValue(globals: GlobalProperties, feature?: Feature) {
        if (!this.zoomTransitioned)
            return this.declaration.calculate(globals, feature);

        // calculate zoom transition between discrete values, such as images and dasharrays.
        const z = globals.zoom;
        const lastIntegerZoom = this.zoomHistory.lastIntegerZoom;

        const fromScale = z > lastIntegerZoom ? 2 : 0.5;
        const from = this.declaration.calculate({zoom: z > lastIntegerZoom ? z - 1 : z + 1}, feature);
        const to = this.declaration.calculate({zoom: z}, feature);

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
