// @flow

import browser from '../util/browser.js';
import type Map from './map.js';
import {bezier, clamp, extend} from '../util/util.js';
import Point from '@mapbox/point-geometry';

import type {DragPanOptions} from './handler/shim/drag_pan.js';
import type {EasingOptions} from '../ui/camera.js';

const defaultInertiaOptions = {
    linearity: 0.3,
    easing: bezier(0, 0, 0.3, 1),
};

const defaultPanInertiaOptions = extend({
    deceleration: 2500,
    maxSpeed: 1400
}, defaultInertiaOptions);

const defaultZoomInertiaOptions = extend({
    deceleration: 20,
    maxSpeed: 1400
}, defaultInertiaOptions);

const defaultBearingInertiaOptions = extend({
    deceleration: 1000,
    maxSpeed: 360
}, defaultInertiaOptions);

const defaultPitchInertiaOptions = extend({
    deceleration: 1000,
    maxSpeed: 90
}, defaultInertiaOptions);

export type InertiaOptions = {
    linearity: number;
    easing: (t: number) => number;
    deceleration: number;
    maxSpeed: number;
};

export type InputEvent = MouseEvent | TouchEvent | KeyboardEvent | WheelEvent;

export default class HandlerInertia {
    _map: Map;
    _inertiaBuffer: Array<{ time: number, settings: Object }>;

    constructor(map: Map) {
        this._map = map;
        this.clear();
    }

    clear() {
        this._inertiaBuffer = [];
    }

    record(settings: any) {
        this._drainInertiaBuffer();
        this._inertiaBuffer.push({time: browser.now(), settings});
    }

    _drainInertiaBuffer() {
        const inertia = this._inertiaBuffer,
            now = browser.now(),
            cutoff = 160;   //msec

        while (inertia.length > 0 && now - inertia[0].time > cutoff)
            inertia.shift();
    }

    _onMoveEnd(panInertiaOptions?: DragPanOptions): ?(EasingOptions & {easeId?: string, preloadOnly?: boolean}) {
        this._drainInertiaBuffer();
        if (this._inertiaBuffer.length < 2) {
            return;
        }

        const deltas = {
            zoom: 0,
            bearing: 0,
            pitch: 0,
            pan: new Point(0, 0),
            pinchAround: undefined,
            around: undefined
        };

        for (const {settings} of this._inertiaBuffer) {
            deltas.zoom += settings.zoomDelta || 0;
            deltas.bearing += settings.bearingDelta || 0;
            deltas.pitch += settings.pitchDelta || 0;
            if (settings.panDelta) deltas.pan._add(settings.panDelta);
            if (settings.around) deltas.around = settings.around;
            if (settings.pinchAround) deltas.pinchAround = settings.pinchAround;
        }

        const lastEntry = this._inertiaBuffer[this._inertiaBuffer.length - 1];
        const duration = (lastEntry.time - this._inertiaBuffer[0].time);

        const easeOptions = {};

        if (deltas.pan.mag()) {
            const result = calculateEasing(deltas.pan.mag(), duration, extend({}, defaultPanInertiaOptions, panInertiaOptions || {}));
            easeOptions.offset = deltas.pan.mult(result.amount / deltas.pan.mag());
            easeOptions.center = this._map.transform.center;
            extendDuration(easeOptions, result);
        }

        if (deltas.zoom) {
            const result = calculateEasing(deltas.zoom, duration, defaultZoomInertiaOptions);
            easeOptions.zoom = this._map.transform.zoom + result.amount;
            extendDuration(easeOptions, result);
        }

        if (deltas.bearing) {
            const result = calculateEasing(deltas.bearing, duration, defaultBearingInertiaOptions);
            easeOptions.bearing = this._map.transform.bearing + clamp(result.amount, -179, 179);
            extendDuration(easeOptions, result);
        }

        if (deltas.pitch) {
            const result = calculateEasing(deltas.pitch, duration, defaultPitchInertiaOptions);
            easeOptions.pitch = this._map.transform.pitch + result.amount;
            extendDuration(easeOptions, result);
        }

        if (easeOptions.zoom || easeOptions.bearing) {
            const last = deltas.pinchAround === undefined ? deltas.around : deltas.pinchAround;
            easeOptions.around = last ? this._map.unproject(last) : this._map.getCenter();
        }

        this.clear();
        easeOptions.noMoveStart = true;
        return easeOptions;
    }
}

// Unfortunately zoom, bearing, etc can't have different durations and easings so
// we need to choose one. We use the longest duration and it's corresponding easing.
function extendDuration(easeOptions, result) {
    if (!easeOptions.duration || easeOptions.duration < result.duration) {
        easeOptions.duration = result.duration;
        easeOptions.easing = result.easing;
    }
}

function calculateEasing(amount, inertiaDuration: number, inertiaOptions) {
    const {maxSpeed, linearity, deceleration} = inertiaOptions;
    const speed = clamp(
        amount * linearity / (inertiaDuration / 1000),
        -maxSpeed,
        maxSpeed);
    const duration = Math.abs(speed) / (deceleration * linearity);
    return {
        easing: inertiaOptions.easing,
        duration: duration * 1000,
        amount: speed * (duration / 2)
    };
}
