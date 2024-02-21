// @flow

import {extend} from '../../util/util.js';
import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../events.js';

import type Map from '../map.js';
import type Point from '@mapbox/point-geometry';
import type {Handler, HandlerResult} from '../handler.js';

export class MapEventHandler implements Handler {
    _mousedownPos: ?Point;
    _clickTolerance: number;
    _map: Map;

    constructor(map: Map, options: { clickTolerance: number }) {
        this._map = map;
        this._clickTolerance = options.clickTolerance;
    }

    reset() {
        this._mousedownPos = undefined;
    }

    // $FlowFixMe[method-unbinding]
    wheel(e: WheelEvent): ?HandlerResult {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - ScrollZoom
        return this._firePreventable(new MapWheelEvent(e.type, this._map, e));
    }

    // $FlowFixMe[method-unbinding]
    mousedown(e: MouseEvent, point: Point): ?HandlerResult {
        this._mousedownPos = point;
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - MousePan
        // - MouseRotate
        // - MousePitch
        // - DblclickHandler
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }

    // $FlowFixMe[method-unbinding]
    mouseup(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    preclick(e: MouseEvent) {
        const synth = extend({}, e);
        synth.type = 'preclick';
        this._map.fire(new MapMouseEvent(synth.type, this._map, synth));
    }

    click(e: MouseEvent, point: Point) {
        if (this._mousedownPos && this._mousedownPos.dist(point) >= this._clickTolerance) return;
        this.preclick(e);
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    // $FlowFixMe[method-unbinding]
    dblclick(e: MouseEvent): ?HandlerResult {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - DblClickZoom
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }

    mouseover(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    mouseout(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    // $FlowFixMe[method-unbinding]
    touchstart(e: TouchEvent): ?HandlerResult {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - TouchPan
        // - TouchZoom
        // - TouchRotate
        // - TouchPitch
        // - TapZoom
        // - SwipeZoom
        return this._firePreventable(new MapTouchEvent(e.type, this._map, e));
    }

    // $FlowFixMe[method-unbinding]
    touchmove(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    // $FlowFixMe[method-unbinding]
    touchend(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    // $FlowFixMe[method-unbinding]
    touchcancel(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    _firePreventable(mapEvent: MapMouseEvent | MapTouchEvent | MapWheelEvent): ?HandlerResult {
        this._map.fire(mapEvent);
        if (mapEvent.defaultPrevented) {
            // returning an object marks the handler as active and resets other handlers
            return {};
        }
    }

    isEnabled(): boolean {
        return true;
    }

    isActive(): boolean {
        return false;
    }
    enable() {}
    disable() {}
}

export class BlockableMapEventHandler {
    _map: Map;
    _delayContextMenu: boolean;
    _contextMenuEvent: ?MouseEvent;

    constructor(map: Map) {
        this._map = map;
    }

    reset() {
        this._delayContextMenu = false;
        this._contextMenuEvent = undefined;
    }

    mousemove(e: MouseEvent) {
        // mousemove map events should not be fired when interaction handlers (pan, rotate, etc) are active
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    mousedown() {
        this._delayContextMenu = true;
    }

    mouseup() {
        this._delayContextMenu = false;
        if (this._contextMenuEvent) {
            this._map.fire(new MapMouseEvent('contextmenu', this._map, this._contextMenuEvent));
            delete this._contextMenuEvent;
        }
    }
    contextmenu(e: MouseEvent) {
        if (this._delayContextMenu) {
            // Mac: contextmenu fired on mousedown; we save it until mouseup for consistency's sake
            this._contextMenuEvent = e;
        } else {
            // Windows: contextmenu fired on mouseup, so fire event now
            this._map.fire(new MapMouseEvent(e.type, this._map, e));
        }

        // prevent browser context menu when necessary
        if (this._map.listens('contextmenu')) {
            e.preventDefault();
        }
    }

    isEnabled(): boolean {
        return true;
    }

    isActive(): boolean {
        return false;
    }
    enable() {}
    disable() {}
}
