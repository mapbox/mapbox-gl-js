import {extend} from '../../util/util';
import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../events';

import type Point from '@mapbox/point-geometry';
import type {Mutable} from 'utility-types';
import type {Map} from '../map';
import type {Handler, HandlerResult} from '../handler';

export class MapEventHandler implements Handler {
    _mousedownPos: Point | null | undefined;
    _clickTolerance: number;
    _map: Map;

    constructor(map: Map, options: {
        clickTolerance: number;
    }) {
        this._map = map;
        this._clickTolerance = options.clickTolerance;
    }

    reset() {
        this._mousedownPos = undefined;
    }

    wheel(e: WheelEvent): HandlerResult | null | undefined {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - ScrollZoom
        return this._firePreventable(new MapWheelEvent(this._map, e));
    }

    mousedown(e: MouseEvent, point: Point): HandlerResult | null | undefined {
        this._mousedownPos = point;
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - MousePan
        // - MouseRotate
        // - MousePitch
        // - DblclickHandler
        return this._firePreventable(new MapMouseEvent(e.type as 'mousedown', this._map, e));
    }

    mouseup(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type as 'mouseup', this._map, e));
    }

    preclick(e: MouseEvent) {
        const synth: Mutable<MouseEvent> = extend({}, e);
        synth.type = 'preclick';
        this._map.fire(new MapMouseEvent(synth.type as 'preclick', this._map, synth));
    }

    click(e: MouseEvent, point: Point) {
        if (this._mousedownPos && this._mousedownPos.dist(point) >= this._clickTolerance) return;
        this.preclick(e);
        this._map.fire(new MapMouseEvent(e.type as 'click', this._map, e));
    }

    dblclick(e: MouseEvent): HandlerResult | null | undefined {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - DblClickZoom
        return this._firePreventable(new MapMouseEvent(e.type as 'dblclick', this._map, e));
    }

    mouseover(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type as 'mouseover', this._map, e));
    }

    mouseout(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type as 'mouseout', this._map, e));
    }

    touchstart(e: TouchEvent): HandlerResult | null | undefined {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - TouchPan
        // - TouchZoom
        // - TouchRotate
        // - TouchPitch
        // - TapZoom
        // - SwipeZoom
        return this._firePreventable(new MapTouchEvent(e.type as 'touchstart', this._map, e));
    }

    touchmove(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type as 'touchstart', this._map, e));
    }

    touchend(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type as 'touchend', this._map, e));
    }

    touchcancel(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type as 'touchend', this._map, e));
    }

    _firePreventable(mapEvent: MapMouseEvent | MapTouchEvent | MapWheelEvent): HandlerResult | null | undefined {
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
    _contextMenuEvent: MouseEvent | null | undefined;

    constructor(map: Map) {
        this._map = map;
    }

    reset() {
        this._delayContextMenu = false;
        this._contextMenuEvent = undefined;
    }

    mousemove(e: MouseEvent) {
        // mousemove map events should not be fired when interaction handlers (pan, rotate, etc) are active
        this._map.fire(new MapMouseEvent(e.type as 'mousemove', this._map, e));
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
            this._map.fire(new MapMouseEvent(e.type as 'contextmenu', this._map, e));
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
