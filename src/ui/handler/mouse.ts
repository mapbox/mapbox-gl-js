import * as DOM from '../../util/dom';

import type Point from '@mapbox/point-geometry';
import type {Handler, HandlerResult} from '../handler';
import type {PitchRotateKey} from '../handler_manager';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

// the values for each button in MouseEvent.buttons
const BUTTONS_FLAGS = {
    [LEFT_BUTTON]: 1,
    [RIGHT_BUTTON]: 2
};

// Map from [KeyboardEvent.key](https://developer.mozilla.org/docs/Web/API/KeyboardEvent/key) values
// to [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent) instance properties
const MODIFIER_KEYS = {
    'Control': 'ctrlKey',
    'Alt': 'altKey',
    'Shift': 'shiftKey',
    'Meta': 'metaKey'
} as const;

function buttonStillPressed(e: MouseEvent, button: number) {
    const flag = BUTTONS_FLAGS[button];
    return e.buttons === undefined || (e.buttons & flag) !== flag;
}

class MouseHandler implements Handler {
    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point | null | undefined;
    _eventButton: number | null | undefined;
    _moved: boolean;
    _clickTolerance: number;

    constructor(options: {clickTolerance: number}) {
        this.reset();
        this._clickTolerance = options.clickTolerance || 1;
    }

    blur() {
        this.reset();
    }

    reset() {
        this._active = false;
        this._moved = false;
        this._lastPoint = undefined;
        this._eventButton = undefined;
    }

    _correctButton(e: MouseEvent, button: number): boolean {
        return false; // implemented by child
    }

    _move(lastPoint: Point, point: Point): HandlerResult | null | undefined {
        return {}; // implemented by child
    }

    mousedown(e: MouseEvent, point: Point) {
        if (this._lastPoint) return;

        const eventButton = DOM.mouseButton(e);
        if (!this._correctButton(e, eventButton)) return;

        this._lastPoint = point;
        this._eventButton = eventButton;
    }

    mousemoveWindow(e: MouseEvent, point: Point): HandlerResult | null | undefined {
        const lastPoint = this._lastPoint;
        if (!lastPoint) return;
        e.preventDefault();

        if (this._eventButton != null && buttonStillPressed(e, this._eventButton)) {
            // Some browsers don't fire a `mouseup` when the mouseup occurs outside
            // the window or iframe:
            // https://github.com/mapbox/mapbox-gl-js/issues/4622
            //
            // If the button is no longer pressed during this `mousemove` it may have
            // been released outside of the window or iframe.
            this.reset();
            return;
        }

        if (!this._moved && point.dist(lastPoint) < this._clickTolerance) return;
        this._moved = true;
        this._lastPoint = point;

        // implemented by child class
        return this._move(lastPoint, point);
    }

    mouseupWindow(e: MouseEvent) {
        if (!this._lastPoint) return;
        const eventButton = DOM.mouseButton(e);
        if (eventButton !== this._eventButton) return;
        if (this._moved) DOM.suppressClick();
        this.reset();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled(): boolean {
        return this._enabled;
    }

    isActive(): boolean {
        return this._active;
    }
}

export class MousePanHandler extends MouseHandler {
    override mousedown(e: MouseEvent, point: Point) {
        super.mousedown(e, point);
        if (this._lastPoint) this._active = true;
    }

    override _correctButton(e: MouseEvent, button: number): boolean {
        return button === LEFT_BUTTON && !e.ctrlKey;
    }

    override _move(lastPoint: Point, point: Point): HandlerResult | null | undefined {
        return {
            around: point,
            panDelta: point.sub(lastPoint)
        };
    }
}

export class MouseRotateHandler extends MouseHandler {
    _pitchRotateKey?: 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey';

    constructor(options: {clickTolerance: number; pitchRotateKey?: PitchRotateKey}) {
        super(options);
        this._pitchRotateKey = options.pitchRotateKey ?
            MODIFIER_KEYS[options.pitchRotateKey] :
            undefined;
    }

    override _correctButton(e: MouseEvent, button: number): boolean {
        return this._pitchRotateKey ?
            (button === LEFT_BUTTON && e[this._pitchRotateKey]) :
            (button === LEFT_BUTTON && e.ctrlKey) || (button === RIGHT_BUTTON);
    }

    override _move(lastPoint: Point, point: Point): HandlerResult | null | undefined {
        const degreesPerPixelMoved = 0.8;
        const bearingDelta = (point.x - lastPoint.x) * degreesPerPixelMoved;
        if (bearingDelta) {
            this._active = true;
            return {bearingDelta};
        }
    }

    contextmenu(e: MouseEvent) {
        // if pitch rotation is overridden, don't prevent context menu
        if (this._pitchRotateKey) return;

        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        e.preventDefault();
    }
}

export class MousePitchHandler extends MouseHandler {
    _pitchRotateKey?: 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey';

    constructor(options: {clickTolerance: number; pitchRotateKey?: PitchRotateKey}) {
        super(options);
        this._pitchRotateKey = options.pitchRotateKey ?
            MODIFIER_KEYS[options.pitchRotateKey] :
            undefined;
    }

    override _correctButton(e: MouseEvent, button: number): boolean {
        return this._pitchRotateKey ?
            (button === LEFT_BUTTON && e[this._pitchRotateKey]) :
            (button === LEFT_BUTTON && e.ctrlKey) || (button === RIGHT_BUTTON);
    }

    override _move(lastPoint: Point, point: Point): HandlerResult | null | undefined {
        const degreesPerPixelMoved = -0.5;
        const pitchDelta = (point.y - lastPoint.y) * degreesPerPixelMoved;
        if (pitchDelta) {
            this._active = true;
            return {pitchDelta};
        }
    }

    contextmenu(e: MouseEvent) {
        // if pitch rotation is overridden, don't prevent context menu
        if (this._pitchRotateKey) return;

        // prevent browser context menu when necessary; we don't allow it with rotation
        // because we can't discern rotation gesture start from contextmenu on Mac
        e.preventDefault();
    }
}
