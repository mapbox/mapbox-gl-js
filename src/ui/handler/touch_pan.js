// @flow

import Point from '@mapbox/point-geometry';
import type Map from '../map.js';
import {indexTouches} from './handler_util.js';
import {bindAll} from '../../util/util.js';
import DOM from '../../util/dom.js';

export default class TouchPanHandler {

    _map: Map;
    _el: HTMLElement;
    _enabled: boolean;
    _active: boolean;
    _touches: { [string | number]: Point };
    _minTouches: number;
    _clickTolerance: number;
    _sum: Point;
    _alertContainer: HTMLElement;
    _alertTimer: TimeoutID;

    constructor(map: Map, options: { clickTolerance: number }) {
        this._map = map;
        this._el = map.getCanvasContainer();
        this._minTouches = 1;
        this._clickTolerance = options.clickTolerance || 1;
        this.reset();
        bindAll(['_addTouchPanBlocker', '_showTouchPanBlockerAlert'], this);
    }

    reset() {
        this._active = false;
        this._touches = {};
        this._sum = new Point(0, 0);
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        return this._calculateTransform(e, points, mapTouches);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._active || mapTouches.length < this._minTouches) return;

        // if cooperative gesture handling is set to true, require two fingers to touch pan
        if (this._map._cooperativeGestures && !this._map.isMoving()) {
            if (mapTouches.length === 1) {
                this._showTouchPanBlockerAlert();
                return;
            } else if (this._alertContainer.style.visibility !== 'hidden') {
                // immediately hide alert if it is visible when two fingers are used to pan.
                this._alertContainer.style.visibility = 'hidden';
                clearTimeout(this._alertTimer);
            }
        }

        e.preventDefault();

        return this._calculateTransform(e, points, mapTouches);
    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._calculateTransform(e, points, mapTouches);

        if (this._active && mapTouches.length < this._minTouches) {
            this.reset();
        }
    }

    touchcancel() {
        this.reset();
    }

    _calculateTransform(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (mapTouches.length > 0) this._active = true;

        const touches = indexTouches(mapTouches, points);

        const touchPointSum = new Point(0, 0);
        const touchDeltaSum = new Point(0, 0);
        let touchDeltaCount = 0;

        for (const identifier in touches) {
            const point = touches[identifier];
            const prevPoint = this._touches[identifier];
            if (prevPoint) {
                touchPointSum._add(point);
                touchDeltaSum._add(point.sub(prevPoint));
                touchDeltaCount++;
                touches[identifier] = point;
            }
        }

        this._touches = touches;

        if (touchDeltaCount < this._minTouches || !touchDeltaSum.mag()) return;

        const panDelta = touchDeltaSum.div(touchDeltaCount);
        this._sum._add(panDelta);
        if (this._sum.mag() < this._clickTolerance) return;

        const around = touchPointSum.div(touchDeltaCount);

        return {
            around,
            panDelta
        };
    }

    enable() {
        this._enabled = true;
        if (this._map._cooperativeGestures) {
            this._addTouchPanBlocker();
            // override touch-action css property to enable scrolling page over map
            this._el.classList.add('mapboxgl-touch-pan-blocker-override', 'mapboxgl-scrollable-page');
        }
    }

    disable() {
        this._enabled = false;
        if (this._map._cooperativeGestures) {
            clearTimeout(this._alertTimer);
            this._alertContainer.remove();
            this._el.classList.remove('mapboxgl-touch-pan-blocker-override', 'mapboxgl-scrollable-page');
        }
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }

    _addTouchPanBlocker() {
        if (this._map && !this._alertContainer) {
            this._alertContainer = DOM.create('div', 'mapboxgl-touch-pan-blocker', this._map._container);

            this._alertContainer.textContent = this._map._getUIString('TouchPanBlocker.Message');

            // dynamically set the font size of the touch pan blocker alert message
            this._alertContainer.style.fontSize = `${Math.max(10, Math.min(24, Math.floor(this._el.clientWidth * 0.05)))}px`;
        }
    }

    _showTouchPanBlockerAlert() {
        if (this._alertContainer.style.visibility === 'hidden') this._alertContainer.style.visibility = 'visible';

        this._alertContainer.classList.add('mapboxgl-touch-pan-blocker-show');

        clearTimeout(this._alertTimer);

        this._alertTimer = setTimeout(() => {
            this._alertContainer.classList.remove('mapboxgl-touch-pan-blocker-show');
        }, 500);
    }

}
