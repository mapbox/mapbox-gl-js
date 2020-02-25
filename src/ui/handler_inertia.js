// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import {Event} from '../util/evented';
import DOM from '../util/dom';
import browser from '../util/browser';
import type Map from './map';
import Handler from './handler/handler';
import { log } from './handler/handler_util';
import {bezier, extend} from '../util/util';
import Point from '@mapbox/point-geometry';
import assert from 'assert';

const defaultInertiaOptions = {
    linearity: 0.15,
    easing: bezier(0, 0, 0.15, 1),
    deceleration: 3,
    maxSpeed: 1.5
};
export type InertiaOptions = typeof defaultInertiaOptions;

export type InputEvent = MouseEvent | TouchEvent | KeyboardEvent | WheelEvent;

class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<[string, Handler, allowed]>;
    _inertiaOptions: InertiaOptions;
    _inertiaBuffer: Array<[number, Object]>;
    _eventsInProgress: Object;

    /**
     * @private
     * options.inertiaOptions - linearity, easing, duration, maxSpeed
     */
    constructor(map: Map, options?: Object) {
        this._map = map;
        this._el = this._map.getCanvasContainer();
        this._handlers = [];
        this._inertiaOptions = options.inertiaOptions || defaultInertiaOptions;
        this._inertiaBuffer = [];
    }

    record(settings) {
        this._drainInertiaBuffer();
        this._inertiaBuffer.push([browser.now(), settings]);
    }

    _drainInertiaBuffer() {
        const inertia = this._inertiaBuffer,
            now = browser.now(),
            cutoff = 160;   //msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff)
            inertia.shift();
    }

    _clampSpeed(speed: number) {
        const { maxSpeed } = this._inertiaOptions;
        if (Math.abs(speed) > maxSpeed) {
            if (speed > 0) {
                return maxSpeed;
            } else {
                return -maxSpeed;
            }
        } else {
            return speed;
        }
    }

    _onMoveEnd(originalEvent: *) {
        this._drainInertiaBuffer();
        if (this._inertiaBuffer.length < 2) {
            this._map.fire(new Event('moveend', { originalEvent }));
            return;
        }

        const {linearity, easing, maxSpeed, deceleration} = this._inertiaOptions;

        let deltas = {
            zoom: 0,
            bearing: 0,
            pitch: 0,
            pan: new Point(0, 0),
            around: null
        };
        let firstPoint, lastPoint;
        for (const [time, settings] of this._inertiaBuffer) {
            deltas.zoom += settings.zoomDelta || 0;
            deltas.bearing += settings.bearingDelta || 0;
            deltas.pitch += settings.pitchDelta || 0;
            if (settings.panDelta) deltas.pan._add(settings.panDelta);
            if (settings.around) {
                if (!firstPoint) firstPoint = settings.around;
                lastPoint = settings.around;
            }
            if (settings.setLocationAtPoint) {
                if (!firstPoint) firstPoint = settings.setLocationAtPoint[1];
                lastPoint = settings.setLocationAtPoint[1];
            }
        };

        const lastEntry = this._inertiaBuffer[this._inertiaBuffer.length - 1];
        const duration = (lastEntry[0] - this._inertiaBuffer[0][0]) / 1000;

        const easeOptions = {};

        // calculate speeds and adjust for increased initial animation speed when easing

        if (firstPoint && lastPoint) {

            let panOffset = lastPoint.sub(firstPoint);
            const velocity = panOffset.mult(linearity / duration);
            let panSpeed = velocity.mag(); // px/s

            if (panSpeed > (maxSpeed * 1000)) {
                panSpeed = maxSpeed * 1000;
                velocity._unit()._mult(panSpeed);
            }

            const panEaseDuration = (panSpeed / (deceleration * 1000 * linearity));
            easeOptions.easeDuration = Math.max(easeOptions.easeDuration || 0, panEaseDuration);
            easeOptions.offset = velocity.mult(panEaseDuration / 2);
            easeOptions.center = this._map.transform.center;
        }

        if (deltas.zoom) {
            let zoomSpeed = this._clampSpeed((deltas.zoom * linearity) / duration);
            const zoomEaseDuration = Math.abs(zoomSpeed / (deceleration * linearity)) * 1000;
            const targetZoom = (this._map.transform.zoom) + zoomSpeed * zoomEaseDuration / 2000;
            easeOptions.easeDuration = Math.max(easeOptions.easeDuration || 0, zoomEaseDuration);
            easeOptions.zoom = targetZoom;
        }

        if (deltas.bearing) {
            let bearingSpeed = this._clampSpeed((deltas.bearing * linearity) / duration);
            const bearingEaseDuration = Math.abs(bearingSpeed / (deceleration * linearity)) * 1000;
            const targetBearing = (this._map.transform.bearing) + bearingSpeed * bearingEaseDuration / 2000;
            easeOptions.easeDuration = Math.max(easeOptions.easeDuration || 0, bearingEaseDuration);
            easeOptions.bearing = targetBearing;
        }

        if (deltas.pitch) {
            let pitchSpeed = this._clampSpeed((deltas.pitch * linearity) / duration);
            const pitchEaseDuration = Math.abs(pitchSpeed / (deceleration * linearity)) * 1000;
            const targetPitch = (this._map.transform.pitch) + pitchSpeed * pitchEaseDuration / 2000;
            easeOptions.easeDuration = Math.max(easeOptions.easeDuration || 0, pitchEaseDuration);
            easeOptions.pitch = targetPitch;
        }

        if (easeOptions.zoom || easeOptions.bearing) {
            easeOptions.around = lastPoint ? this._map.unproject(lastPoint) : this._map.getCenter();
        }

        this._map.easeTo(extend(easeOptions, {
            easing,
            noMoveStart: true
        }), { originalEvent });

    }
}


export default HandlerManager;
