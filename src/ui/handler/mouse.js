// @flow

import DOM from '../../util/dom';
import type Point from '@mapbox/point-geometry';
import type InertiaOptions from '../handler_inertia';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

class MouseHandler {

    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point;
    _eventButton: number;
    _notMoved: boolean;
    _options: InertiaOptions;
    _clickTolerance: number;

    constructor(options: { clickTolerance: number }) {
        this.reset();
        this._clickTolerance = options.clickTolerance || 1;
    }

    reset() {
        this._active = false;
        this._notMoved = true;
        delete this._lastPoint;
        delete this._eventButton;
    }

    _correctButton(e: MouseEvent, button: number) {  //eslint-disable-line
        return false; // implemented by child
    }

    _move(lastPoint: Point, point: Point) {  //eslint-disable-line
        return {}; // implemented by child
    }

    mousedown(e: MouseEvent, point: Point) {
        if (this._lastPoint) return;

        const eventButton = DOM.mouseButton(e);
        if (!this._correctButton(e, eventButton)) return;

        this._lastPoint = point;
        this._eventButton = eventButton;
        this._active = true;
    }

    windowMousemove(e: MouseEvent, point: Point) {
        const lastPoint = this._lastPoint;
        if (!lastPoint) return;

        if (this._notMoved && point.dist(lastPoint) < this._clickTolerance) return;
        this._notMoved = false;
        this._lastPoint = point;

        // implemented by child class
        return this._move(lastPoint, point);
    }

    windowMouseup(e: MouseEvent) {
        const eventButton = DOM.mouseButton(e);
        if (eventButton !== this._eventButton) return;
        this.reset();
    }

    enable(options?: InertiaOptions) {
        this._enabled = true;
        if (options) this._options = options;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}

export class MousePanHandler extends MouseHandler {
    _correctButton(e: MouseEvent, button: number) {
        return button === LEFT_BUTTON && !e.ctrlKey;
    }

    _move(lastPoint: Point, point: Point) {
        return {
            around: point,
            panDelta: point.sub(lastPoint)
        };
    }
}

export class MouseRotateHandler extends MouseHandler {
    _correctButton(e: MouseEvent, button: number) {
        return (button === LEFT_BUTTON && e.ctrlKey) || (button === RIGHT_BUTTON);
    }

    _move(lastPoint: Point, point: Point) {
        const bearingDelta = (lastPoint.x - point.x) * -0.8;
        if (bearingDelta) {
            this._active = true;
            return {bearingDelta};
        }
    }

    contextmenu(e: MouseEvent) {
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        e.preventDefault();
    }
}

export class MousePitchHandler extends MouseHandler {
    _correctButton(e: MouseEvent, button: number) {
        return (button === LEFT_BUTTON && e.ctrlKey) || (button === RIGHT_BUTTON);
    }

    _move(lastPoint: Point, point: Point) {
        const pitchDelta = (lastPoint.y - point.y) * 0.5;
        if (pitchDelta) {
            this._active = true;
            return {pitchDelta};
        }
    }

    contextmenu(e: MouseEvent) {
        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        e.preventDefault();
    }
}
