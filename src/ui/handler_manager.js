// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import {Event} from '../util/evented';
import DOM from '../util/dom';
import browser from '../util/browser';
import type Map from './map';
import HandlerInertia from './handler_inertia';
import BoxZoomHandler from './handler/box_zoom';
import TapZoomHandler from './handler/tap_zoom';
import MousePanHandler from './handler/mouse_pan';
import MousePitchHandler from './handler/mouse_pitch';
import MouseRotateHandler from './handler/mouse_rotate';
import TouchPanHandler from './handler/touch_pan';
import TouchZoomHandler from './handler/touch_zoom';
import TouchRotateHandler from './handler/touch_rotate';
import TouchPitchHandler from './handler/touch_pitch';
import KeyboardHandler from './handler/keyboard';
import ScrollZoomHandler from './handler/scroll_zoom';
import ClickZoomHandler from './handler/dblclick_zoom';
import SwipeZoomHandler from './handler/swipe_zoom';
import {bezier, extend} from '../util/util';
import Point from '@mapbox/point-geometry';
import assert from 'assert';
import type {AnimationOptions} from './camera';

export type InputEvent = MouseEvent | TouchEvent | KeyboardEvent | WheelEvent;

class RenderFrameEvent extends Event {
    type: 'renderFrame';
    timeStamp: number;
}

// TODO
export interface Handler {
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;
    reset(): void;
    +touchstart?: (e: TouchEvent, points: Array<Point>) => HandlerResult | void;
    +touchmove?: (e: TouchEvent, points: Array<Point>) => HandlerResult | void;
    +touchend?: (e: TouchEvent, points: Array<Point>) => HandlerResult | void;
    +touchcancel?: (e: TouchEvent, points: Array<Point>) => HandlerResult | void;
    +mousedown?: (e: MouseEvent, point: Point) => HandlerResult | void;
    +mousemove?: (e: MouseEvent, point: Point) => HandlerResult | void;
    +mouseup?: (e: MouseEvent, point: Point) => HandlerResult | void;
    +dblclick?: (e: MouseEvent, point: Point) => HandlerResult | void;
    +wheel?: (e: WheelEvent, point: Point) => HandlerResult | void;
    +keydown?: (e: KeyboardEvent) => HandlerResult | void;
    +keyup?: (e: KeyboardEvent) => HandlerResult | void;
    +renderFrame?: () => HandlerResult | void;
}

export type HandlerResult = {|
    panDelta?: Point,
    zoomDelta?: number,
    bearingDelta?: number,
    pitchDelta?: number,
    around?: Point,
    duration?: number,
    easing?: (number) => number,
    originalEvent?: any,
    delayEndEvents?: number,
    needsRenderFrame?: boolean
|};

function hasChange(result: HandlerResult) {
    return (result.panDelta && result.panDelta.mag()) || result.zoomDelta || result.bearingDelta || result.pitchDelta;
}

class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<[string, Handler, any]>;
    eventsInProgress: Object;
    _frameId: number;
    inertia: HandlerInertia;
    _handlersById: { [string]: Handler };
    _updatingCamera: boolean;
    _changes: Array<[HandlerResult, Object, any]>;

    /**
     * @private
     * options.inertiaOptions - linearity, easing, duration, maxSpeed
     */
    constructor(map: Map, options?: Object) {
        this._map = map;
        this._el = this._map.getCanvasContainer();
        this._handlers = [];
        this._handlersById = {};
        this._changes = [];

        this.inertia = new HandlerInertia(map, options);

        // Track whether map is currently moving, to compute start/move/end events
        this.eventsInProgress = {};

        this._addDefaultHandlers();

        // Bind touchstart and touchmove with passive: false because, even though
        // they only fire a map events and therefore could theoretically be
        // passive, binding with passive: true causes iOS not to respect
        // e.preventDefault() in _other_ handlers, even if they are non-passive
        // (see https://bugs.webkit.org/show_bug.cgi?id=184251)
        this.addTouchListener('touchstart', {passive: false});
        this.addTouchListener('touchmove', {passive: false});
        this.addTouchListener('touchend');
        this.addTouchListener('touchcancel');

        this.addMouseListener('mousedown');
        this.addMouseListener('mousemove', {}, window);
        this.addMouseListener('mouseup', {}, window);
        this.addMouseListener('mouseover');
        this.addMouseListener('mouseout');

        this.addKeyboardListener('keydown');
        this.addKeyboardListener('keyup');
        this.addListener('wheel', undefined, {passive: false});
        this.addListener('dblclick', undefined);

        DOM.addEventListener(window.document, 'contextmenu', e => e.preventDefault());
    }

    _addDefaultHandlers() {
        const el = this._map.getCanvasContainer();
        this.add('boxZoom', new BoxZoomHandler(this._map, this));
        this.add('tapzoom', new TapZoomHandler());
        this.add('swipeZoom', new SwipeZoomHandler());
        this.add('clickzoom', new ClickZoomHandler());
        this.add('mouserotate', new MouseRotateHandler(), ['mousepitch']);
        this.add('mousepitch', new MousePitchHandler(), ['mouserotate']);
        this.add('mousepan', new MousePanHandler());
        this.add('touchPitch', new TouchPitchHandler());
        this.add('touchRotate', new TouchRotateHandler(), ['touchPan', 'touchZoom']);
        this.add('touchZoom', new TouchZoomHandler(), ['touchPan', 'touchRotate']);
        this.add('touchPan', new TouchPanHandler(), ['touchZoom','touchRotate']);
        this.add('scrollzoom', new ScrollZoomHandler(this._map, this));
        this.add('keyboard', new KeyboardHandler());
    }

    add(handlerName: string, handler: Handler, allowed?: Array<string>) {
        if (this._handlersById[handlerName]) {
            throw new Error(`Cannot add ${handlerName}: a handler with that name already exists`);
        }
        this._handlers.push([handlerName, handler, allowed]);
        this._handlersById[handlerName] = handler;
        handler.enable();
    }

    addListener(eventType: string, mapEventClass?: Class<MapMouseEvent | MapTouchEvent | MapWheelEvent>, options?: Object, el: any) {
        const listener = (e: *) => {
            if (mapEventClass) this._map.fire(new mapEventClass(eventType, this._map, e));
            this.processInputEvent(e);
        };
        DOM.addEventListener(el || this._el, eventType, listener, options);
    }

    addTouchListener(eventType: string, options?: Object) {
        this.addListener(eventType, MapTouchEvent, options);
    }

    addMouseListener(eventType: string, options?: Object, el: any) {
        this.addListener(eventType, MapMouseEvent, options, el);
    }

    addKeyboardListener(eventType: string, options?: Object) {
        this.addListener(eventType, undefined, extend({capture: false}, options)); // No such thing as MapKeyboardEvent to fire
    }

    stop() {
        // do nothing if this method was triggered by a gesture update
        if (this._updatingCamera) return;

        for (const [name, handler] of this._handlers) {
            handler.reset();
        }
        this.inertia.clear();
        this.fireEvents({});
        this._changes = [];
    }

    blockedByActive(activeHandlers: { [string]: Handler }, allowed: Array<string>, myName: string) { 
        for (const name in activeHandlers) {
            if (name === myName) continue;
            if (!allowed || allowed.indexOf(name) < 0) {
                return true;
            }
        }
        return false;
    }

    processInputEvent(e: InputEvent | RenderFrameEvent) {

        assert(e.timeStamp !== undefined);

        // TODO
        if (e && e.cancelable && (e instanceof MouseEvent ? e.type === 'mousemove' : true)) ((e: any): MouseEvent).preventDefault();

        const mergedHandlerResult: HandlerResult = {needsRenderFrame: false};
        const eventsInProgress = {};
        const activeHandlers = {};

        const points = e ? (e.targetTouches ?
            DOM.touchPos(this._el, ((e: any): TouchEvent).targetTouches) :
            DOM.mousePos(this._el, ((e: any): MouseEvent))) : null;

        for (const [name, handler, allowed] of this._handlers) {
            if (!handler.isEnabled()) continue;

            let data: HandlerResult | void;
            if (this.blockedByActive(activeHandlers, allowed, name)) {
                handler.reset();

            } else {
                if ((handler: any)[e.type]) {
                    data = (handler: any)[e.type](e, points);
                    this.mergeHandlerResult(mergedHandlerResult, eventsInProgress, data, name);
                    if (data && data.needsRenderFrame) {
                        this.triggerRenderFrame();
                    }
                }
            }

            if (data || handler.isActive()) {
                activeHandlers[name] = handler;
            } else {
                delete activeHandlers[name];
            }
        }

        if (hasChange(mergedHandlerResult)) {
            this._changes.push([mergedHandlerResult, eventsInProgress, e]);
            this.triggerRenderFrame();
        }
    }

    mergeHandlerResult(mergedHandlerResult: HandlerResult, eventsInProgress: Object, handlerResult: HandlerResult, name: string) {
        if (!handlerResult) return;

        extend(mergedHandlerResult, handlerResult);

        // track which handler changed which camera property
        if (handlerResult.zoomDelta !== undefined) {
            eventsInProgress.zoom = name;
        }
        if (handlerResult.panDelta !== undefined) {
            eventsInProgress.drag = name;
        }
        if (handlerResult.pitchDelta !== undefined) {
            eventsInProgress.pitch = name;
        }
        if (handlerResult.bearingDelta !== undefined) {
            eventsInProgress.rotate = name;
        }

    }

    applyChanges() {
        let combined = {};
        let combinedEventsInProgress = {};

        for (const [change, eventsInProgress, e] of this._changes) {

            if (change.duration && combined.duration) {
                // an animated change overrides all previous changes
                combined = {};
                combinedEventsInProgress = {};
            }

            if (change.duration) combined.duration = change.duration;
            if (change.easing) combined.easing = change.easing;
            if (change.panDelta) combined.panDelta = (combined.panDelta || new Point(0, 0))._add(change.panDelta);
            if (change.zoomDelta) combined.zoomDelta = (combined.zoomDelta || 0) + change.zoomDelta;
            if (change.bearingDelta) combined.bearingDelta = (combined.bearingDelta || 0) + change.bearingDelta;
            if (change.pitchDelta) combined.pitchDelta = (combined.pitchDelta || 0) + change.pitchDelta;
            if (change.around) combined.around = change.around;

            extend(combinedEventsInProgress, eventsInProgress);
        }
        
        // TODO pass original event
        this.updateMapTransform(combined, combinedEventsInProgress);
        this._changes = [];
    }

    updateMapTransform(combinedResult: any, combinedEventsInProgress: Object, e?: InputEvent | RenderFrameEvent) {
        
        if (!hasChange(combinedResult)) return;
        const map = this._map;
        const tr = map.transform;

        this._updatingCamera = true;

        // stop any ongoing camera animations (easeTo, flyTo)
        map._stop(true);

        let { panDelta, zoomDelta, bearingDelta, pitchDelta, around } = combinedResult;

        if (combinedResult.duration) {
            const easeOptions = {};
            easeOptions.duration = combinedResult.duration;
            if (combinedResult.delayEndEvents) easeOptions.delayEndEvents = combinedResult.delayEndEvents;
            if (combinedResult.easing) easeOptions.easing = combinedResult.easing;

            if (panDelta) easeOptions.center = map.unproject(tr.centerPoint.sub(panDelta));
            if (zoomDelta) easeOptions.zoom = tr.zoom + zoomDelta;
            if (bearingDelta) easeOptions.bearing = tr.bearing + bearingDelta;
            if (pitchDelta) easeOptions.pitch = tr.pitch + pitchDelta;
            if (around) easeOptions.around = map.unproject(around);

            this.inertia.clear();
            map.easeTo(easeOptions);

        } else {

            around = around || map.transform.centerPoint;
            const loc = tr.pointLocation(panDelta ? around.sub(panDelta) : around);
            if (bearingDelta) tr.bearing += bearingDelta;
            if (pitchDelta) tr.pitch += pitchDelta;
            if (zoomDelta) tr.zoom += zoomDelta;
            tr.setLocationAtPoint(loc, around);

            this._map._update();
            this.inertia.record(combinedResult);
            this.fireEvents(combinedEventsInProgress);
        }

        this._updatingCamera = false;
    }


    fireEvents(newEventsInProgress: { [string]: string }, e?: InputEvent) {
        const wasMoving = !!Object.keys(this.eventsInProgress).length;
        const isMoving = !!Object.keys(newEventsInProgress).length;

        if (!wasMoving && isMoving) {
            this._fireEvent('movestart', e);
        }

        for (const eventName in newEventsInProgress) {
            const handlerName = newEventsInProgress[eventName];
            if (!this.eventsInProgress[eventName]) {
                this._fireEvent(eventName + 'start', e);
            }
            this.eventsInProgress[eventName] = handlerName;
        }

        if (isMoving) {
            this._fireEvent('move', e);
        }

        for (const eventName in newEventsInProgress) {
            this._fireEvent(eventName, e);
        }

        for (const eventName in this.eventsInProgress) {
            const handlerName = this.eventsInProgress[eventName];
            if (!this._handlersById[handlerName].isActive()) {
                delete this.eventsInProgress[eventName];
                this._fireEvent(eventName + 'end', e);
            }
        }

        const stillMoving = !!Object.keys(this.eventsInProgress).length;
        if ((wasMoving || isMoving) && !stillMoving) {
            this.inertia._onMoveEnd(e);
            // TODO inertia handles this
            //this._fireEvent('moveend');
        }

    }

    _fireEvent(type: string, e: *) {
        this._map.fire(new Event(type, e ? {originalEvent: e} : {}));
    }

    triggerRenderFrame() {
        if (this._frameId === undefined) {
            this._frameId = this._map._requestRenderFrame(timeStamp => {
                delete this._frameId;
                this.processInputEvent(new RenderFrameEvent('renderFrame', { timeStamp }));
                this.applyChanges();
            });
        }
    }

}


export default HandlerManager;
