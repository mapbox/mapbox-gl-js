// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import {Event} from '../util/evented';
import DOM from '../util/dom';
import browser from '../util/browser';
import type Map from './map';
import HandlerInertia from './handler_inertia';
//import { TouchPanHandler, TouchZoomHandler, TouchRotateHandler, TouchPitchHandler } from './handler/touch';
/*
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
import ClickZoomHandler from './handler/click_zoom';
import SwipeZoomHandler from './handler/swipe_zoom';
*/
import { log } from './handler/handler_util';
import {bezier, extend} from '../util/util';
import Point from '@mapbox/point-geometry';
import assert from 'assert';

export type InertiaOptions = typeof defaultInertiaOptions;

export type InputEvent = MouseEvent | TouchEvent | KeyboardEvent | WheelEvent;

export type CameraDeltaOptions = {
    panDelta?: Point,
    zoomDelta?: number,
    bearingDelta?: number,
    pitchDelta?: number,
    around?: Point 
};

export type HandlerResult = CameraDeltaOptions & AnimationOptions & {
    originalEvent?: any,
    needsRenderFrame?: boolean
};

class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<[string, Handler, allowed]>;
    eventsInProgress: Object;
    touchPan: TouchPanHandler;
    touchZoom: TouchZoomHandler;
    touchRotate: TouchRotateHandler;
    touchPitch: TouchPitchHandler;

    /**
     * @private
     * options.inertiaOptions - linearity, easing, duration, maxSpeed
     */
    constructor(map: Map, options?: Object) {
        this._map = map;
        this._el = this._map.getCanvasContainer();
        this._handlers = [];

        this._frameId = null;
        this.inertia = new HandlerInertia(map, options);

        this.onRenderFrame = this.onRenderFrame.bind(this);

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
        this.addListener('wheel', null, {passive: false});
        this.addListener('dblclick', null);

        DOM.addEventListener(window.document, 'contextmenu', e => e.preventDefault());
    }

    _addDefaultHandlers() {
        const el = this._map.getCanvasContainer();
        /*
        this.add('boxZoom', new BoxZoomHandler(this._map, this));
        this.add('tapzoom', new TapZoomHandler(this._map, this));
        this.add('swipeZoom', new SwipeZoomHandler(this._map, this));
        this.add('clickzoom', new ClickZoomHandler(this._map, this));
        this.add('mouserotate', new MouseRotateHandler(), ['mousepitch']);
        this.add('mousepitch', new MousePitchHandler(), ['mouserotate']);
        this.add('mousepan', new MousePanHandler());
        this.add('touchPitch', new TouchPitchHandler());
        this.add('touchPan', new TouchPanHandler(), ['touchZoom','touchRotate']);
        this.add('touchRotate', new TouchRotateHandler(), ['touchPan', 'touchZoom']);
        this.add('touchZoom', new TouchZoomHandler(), ['touchPan', 'touchRotate']);
        this.add('scrollzoom', new ScrollZoomHandler(this._map, this));
        this.add('keyboard', new KeyboardHandler(this._map));
        */
    }

    add(handlerName: string, handler: Handler, allowed: Array<string>) {

        if (this[handlerName]) throw new Error(`Cannot add ${handlerName}: a handler with that name already exists`);
        this._handlers.push([handlerName, handler, allowed]);
        this[handlerName] = handler;
        handler.enable();
    }

    remove(handlerName: string) {
        if (!handlerName || typeof handlerName !== 'string') throw new Error('Must provide a valid handlerName string');
        if (!this[handlerName]) throw new Error(`Handler ${handlerName} not found`);
        const newHandlers = this._handlers.filter(([existingName, existingHandler]) => {
            if (existingName === handlerName) {
                delete this[handlerName];
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

    addListener(eventType: string, mapEventClass?: Class<MapMouseEvent | MapTouchEvent | MapWheelEvent>, options?: Object, el) {
        const listener = (e: *) => {
            if (mapEventClass) this._map.fire(new mapEventClass(eventType, this._map, e));
            this.processInputEvent(e);
        };
        DOM.addEventListener(el || this._el, eventType, listener, options);
    }

    addTouchListener(eventType: string, options?: Object) {
        this.addListener(eventType, MapTouchEvent, options);
    }

    addMouseListener(eventType: string, options?: Object, el) {
        this.addListener(eventType, MapMouseEvent, options, el);
    }

    addKeyboardListener(eventType: string, options?: Object) {
        this.addListener(eventType, null, extend({capture: false}, options)); // No such thing as MapKeyboardEvent to fire
    }

    stop() {
        return;
        for (const [name, handler] of this._handlers) {
            handler.reset();
        }
        this.inertia.clear();
        this.fireEvents({});
    }

    blockedByActive(activeHandlers, allowed, myName) { 
        for (const name in activeHandlers) {
            if (name === myName) continue;
            if (!allowed || allowed.indexOf(name) < 0) {
                return true;
            }
        }
        return false;
    }

    processInputEvent(e: InputEvent) {

        assert(e.timeStamp !== undefined);
        console.log(e.type);

        //log('', true);
        // TODO
        if (e && e.cancelable && (e instanceof MouseEvent ? e.type === 'mousemove' : true)) e.preventDefault();
        let transformSettings = { eventsInProgress: {} };
        let activeHandlers = {};

        let points = e ? (e.touches ?
            DOM.touchPos(this._el, e) :
            DOM.mousePos(this._el, e)) : null;

        //try {
        for (const [name, handler, allowed] of this._handlers) {
            if (!handler.isEnabled()) continue;

            let data;
            if (this.blockedByActive(activeHandlers, allowed, name)) {
                if (!handler.reset) console.log(handler);
                else handler.reset();

            } else {
                if (handler[e.type]) {
                    data = handler[e.type](e, points);
                    this.mergeTransform(transformSettings, data, name);
                    if (data && data.needsRenderFrame) {
                        console.log("HERE");
                        this.triggerRenderFrame();
                    }
                }
            }

            if ((data && data.transform) || handler.isActive()) {
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

    mergeTransform(transformSettings, data, name) {
        if (!data || !data.transform) return;

        extend(transformSettings, data.transform);

        const eventsInProgress = transformSettings.eventsInProgress;
        if (data.transform.zoomDelta !== undefined) {
            eventsInProgress.zoom = name;
        }
        if (data.transform.panDelta !== undefined) {
            eventsInProgress.drag = name;
        }
        if (data.transform.pitchDelta !== undefined) {
            eventsInProgress.pitch = name;
        }
        if (data.transform.rotateDelta !== undefined) {
            eventsInProgress.rotate = name;
        }

    }

    updateMapTransform(settings: Object, e) {
        const map = this._map;


        let { zoomDelta, bearingDelta, pitchDelta, setLocationAtPoint, around, panDelta } = settings;
        
        if (zoomDelta || bearingDelta || pitchDelta || panDelta || settings.duration) {
            this._map.stop();
        }

        if (settings.duration) {
            const easeOptions = {
                duration: settings.duration,
                delayEndEvents: settings.delayEndEvents
            }
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
            return;
        }


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


    fireEvents(newEventsInProgress, e) {
        const wasMoving = !!Object.keys(this.eventsInProgress).length;
        const isMoving = !!Object.keys(newEventsInProgress).length;

        if (!wasMoving && isMoving) {
            this._fireEvent('movestart', e);
        }

        for (const eventName in newEventsInProgress) {
            const handlerName = newEventsInProgress[eventName];
            if (!this.eventsInProgress[name]) {
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
            if (!this[handlerName].isActive()) {
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

    onRenderFrame(timeStamp) {
        this._frameId = null;
        this.processInputEvent(new Event('renderFrame', { timeStamp }));
    }

    triggerRenderFrame() {
        if (this._frameId === null) {
            this._frameId = this._map._requestRenderFrame(this.onRenderFrame);
        }
    }

}


export default HandlerManager;
