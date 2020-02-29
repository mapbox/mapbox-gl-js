// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import {Event} from '../util/evented';
import DOM from '../util/dom';
import browser from '../util/browser';
import type Map from './map';
import HandlerInertia from './handler_inertia';
//import { TouchPanHandler, TouchZoomHandler, TouchRotateHandler, TouchPitchHandler } from './handler/touch';
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
import { log } from './handler/handler_util';
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

class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<[string, Handler, any]>; // TODO
    eventsInProgress: Object;
    touchPan: TouchPanHandler;
    touchZoom: TouchZoomHandler;
    touchRotate: TouchRotateHandler;
    touchPitch: TouchPitchHandler;
    _frameId: number;
    inertia: HandlerInertia;
    handlers: { [string]: Handler };
    updating: boolean;

    /**
     * @private
     * options.inertiaOptions - linearity, easing, duration, maxSpeed
     */
    constructor(map: Map, options?: Object) {
        this._map = map;
        this._el = this._map.getCanvasContainer();
        this._handlers = [];
        this.handlers = {};

        this.inertia = new HandlerInertia(map, options);

        window.onerror = function(e) {
            log(e);
        }

        // Track whether map is currently moving, to compute start/move/end events
        this.eventsInProgress = {
        };


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
        this.add('touchPan', new TouchPanHandler(), ['touchZoom','touchRotate']);
        this.add('touchRotate', new TouchRotateHandler(), ['touchPan', 'touchZoom']);
        this.add('touchZoom', new TouchZoomHandler(), ['touchPan', 'touchRotate']);
        this.add('scrollzoom', new ScrollZoomHandler(this._map, this));
        this.add('keyboard', new KeyboardHandler());
        /*
        */
    }

    add(handlerName: string, handler: Handler, allowed?: Array<string>) {

        if (this.handlers[handlerName]) throw new Error(`Cannot add ${handlerName}: a handler with that name already exists`);
        this._handlers.push([handlerName, handler, allowed]);
        this.handlers[handlerName] = handler;
        handler.enable();
    }

    remove(handlerName: string) {
        if (!handlerName || typeof handlerName !== 'string') throw new Error('Must provide a valid handlerName string');
        if (!this.handlers[handlerName]) throw new Error(`Handler ${handlerName} not found`);
        const newHandlers = this._handlers.filter(([existingName, existingHandler]) => {
            if (existingName === handlerName) {
                delete this.handlers[handlerName];
                return false;
            }
            return true;
        });
        this._handlers = newHandlers;
    }

    removeAll() {
        for (const [handlerName, _] of this._handlers) this.remove(handlerName);
    }

    disableAll() {
        for (const [_, handler] of this._handlers) handler.disable();
    }

    enableAll() {
        for (const [_, handler] of this._handlers) handler.enable();
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
        if (this.updating) return;
        for (const [name, handler] of this._handlers) {
            handler.reset();
        }
        this.inertia.clear();
        this.fireEvents({});
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
        console.log(e.type);

        //log('', true);
        // TODO
        if (e && e.cancelable && (e instanceof MouseEvent ? e.type === 'mousemove' : true)) ((e: any): MouseEvent).preventDefault();
        let transformSettings = { eventsInProgress: {} };
        let activeHandlers = {};

        let points = e ? (e.targetTouches ?
            DOM.touchPos(this._el, ((e: any): TouchEvent).targetTouches) :
            DOM.mousePos(this._el, ((e: any): MouseEvent))) : null;

        //try {
        for (const [name, handler, allowed] of this._handlers) {
            if (!handler.isEnabled()) continue;

            let data: HandlerResult | void;
            if (this.blockedByActive(activeHandlers, allowed, name)) {
                if (!handler.reset) console.log(handler);
                else handler.reset();

            } else {
                if ((handler: any)[e.type]) {
                    // TODO
                    data = (handler: any)[e.type](e, points);
                    this.mergeTransform(transformSettings, data, name);
                    if (data && data.needsRenderFrame) {
                        console.log("HERE");
                        this.triggerRenderFrame();
                    }
                }
            }

            if ((data) || handler.isActive()) {
                activeHandlers[name] = handler;
            } else {
                delete activeHandlers[name];
            }
        }
        //} catch(e) {
            //log(e);
        //}


        //log('active' + Object.keys(activeHandlers));
        if (Object.keys(transformSettings).length) {
            this.updateMapTransform(transformSettings, e);
        }
    }

    mergeTransform(transformSettings: any, data: any, name: string) {
        if (!data) return;

        extend(transformSettings, data);

        const eventsInProgress = transformSettings.eventsInProgress;
        if (data.zoomDelta !== undefined) {
            eventsInProgress.zoom = name;
        }
        if (data.panDelta !== undefined) {
            eventsInProgress.drag = name;
        }
        if (data.pitchDelta !== undefined) {
            eventsInProgress.pitch = name;
        }
        if (data.rotateDelta !== undefined) {
            eventsInProgress.rotate = name;
        }

    }

    updateMapTransform(settings: any, e?: InputEvent | RenderFrameEvent) {
        const map = this._map;

        this.updating = true;

        let { zoomDelta, bearingDelta, pitchDelta, setLocationAtPoint, around, panDelta } = settings;
        
        if (zoomDelta || bearingDelta || pitchDelta || panDelta || settings.duration) {
            this._map._stop(true);
        }

        if (settings.duration) {
            const easeOptions = {};

            easeOptions.duration = settings.duration;
            easeOptions.delayEndEvents = settings.delayEndEvents;

            if (settings.easing) easeOptions.easing = settings.easing;

            if (zoomDelta) {
                easeOptions.zoom = map.getZoom() + zoomDelta;
            }

            if (panDelta) {
                easeOptions.center = map.unproject(map.project(map.getCenter()).sub(panDelta));
            }

            if (around) {
                easeOptions.around = map.unproject(around);
            }

            if (pitchDelta) {
            }

            map.easeTo(easeOptions);
            this.inertia.clear();
        } else {


        const tr = this._map.transform;
        this.inertia.record(settings);

        if (zoomDelta) {
            const loc = around ? tr.pointLocation(around) : null;
            tr.zoom += zoomDelta;
            if (loc) tr.setLocationAtPoint(loc, around);
        }
        if (bearingDelta) tr.bearing += bearingDelta;
        if (pitchDelta) tr.pitch += pitchDelta;
        if (panDelta) {
            around = around || new Point(0, 0);
            tr.setLocationAtPoint(tr.pointLocation(around.sub(panDelta)), around);
        }
        if (setLocationAtPoint && setLocationAtPoint.length === 2) {
            let [loc, pt] = setLocationAtPoint;
            tr.setLocationAtPoint(loc, pt);
        }
        this._map._update();

        this.fireEvents(settings.eventsInProgress);
        }
        this.updating = false;

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
            if (!this.handlers[handlerName].isActive()) {
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
            });
        }
    }

}


export default HandlerManager;
