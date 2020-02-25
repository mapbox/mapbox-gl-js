// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import {Event} from '../util/evented';
import DOM from '../util/dom';
import browser from '../util/browser';
import type Map from './map';
import Handler from './handler/handler';
import HandlerInertia from './handler_inertia';
//import { TouchPanHandler, TouchZoomHandler, TouchRotateHandler, TouchPitchHandler } from './handler/touch';
import MousePanHandler from './handler/mouse_pan';
import MousePitchHandler from './handler/mouse_pitch';
import MouseRotateHandler from './handler/mouse_rotate';
import TouchPanHandler from './handler/touch_pan';
import TouchZoomHandler from './handler/touch_zoom';
import TouchRotateHandler from './handler/touch_rotate';
import TouchPitchHandler from './handler/touch_pitch';
import KeyboardHandler from './handler/keyboard';
import { log } from './handler/handler_util';
import {bezier, extend} from '../util/util';
import Point from '@mapbox/point-geometry';
import assert from 'assert';

export type InertiaOptions = typeof defaultInertiaOptions;

export type InputEvent = MouseEvent | TouchEvent | KeyboardEvent | WheelEvent;

class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<[string, Handler, allowed]>;
    _eventsInProgress: Object;
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
        this.activeHandlers = {};

        this.inertia = new HandlerInertia(map, options);

        window.onerror = function(e) {
            log(e);
        }

        // Track whether map is currently moving, to compute start/move/end events
        this._eventsInProgress = {
            zoom: false,
            rotate: false,
            pitch: false,
            drag: false
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
        this.addMouseListener('mousemove');
        this.addMouseListener('mouseup');
        this.addMouseListener('mouseover');
        this.addMouseListener('mouseout');

        this.addKeyboardListener('keydown');
        this.addKeyboardListener('keyup');

        DOM.addEventListener(window.document, 'contextmenu', e => e.preventDefault());
    }

    _addDefaultHandlers() {
        this.add('mousepan', new MousePanHandler(this._map, this));
        this.add('mouserotate', new MouseRotateHandler(this._map));
        this.add('mousepitch', new MousePitchHandler(this._map));
        this.add('touchPitch', new TouchPitchHandler(this._map));
        this.add('touchPan', new TouchPanHandler(this._map), ['touchZoom','touchRotate']);
        this.add('touchZoom', new TouchZoomHandler(this._map), ['touchPan', 'touchRotate']);
        this.add('touchRotate', new TouchRotateHandler(this._map), ['touchPan', 'touchZoom']);
        this.add('keyboard', new KeyboardHandler(this._map));
    }

    add(handlerName: string, handler: Handler, allowed: Array<string>) {
        if (!handler || !(handler instanceof Handler)) throw new Error('Must provide a valid Handler instance');

        if (this[handlerName]) throw new Error(`Cannot add ${handlerName}: a handler with that name already exists`);
        this._handlers.push([handlerName, handler, allowed]);
        this[handlerName] = handler;
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

    addListener(eventType: string, mapEventClass?: Class<MapMouseEvent | MapTouchEvent | MapWheelEvent>, options?: Object) {
        const listener = (e: *) => {
            if (mapEventClass) this._map.fire(new mapEventClass(eventType, this._map, e));
            this.processInputEvent(e);
        };
        DOM.addEventListener(this._el, eventType, listener, options);
    }

    addTouchListener(eventType: string, options?: Object) {
        this.addListener(eventType, MapTouchEvent, options);
    }

    addMouseListener(eventType: string, options?: Object) {
        this.addListener(eventType, MapMouseEvent, options);
    }

    addKeyboardListener(eventType: string, options?: Object) {
        this.addListener(eventType, null, extend({capture: false}, options)); // No such thing as MapKeyboardEvent to fire
    }

    stop() {
    }

    blockedByActive(activeHandlers, allowed, myName) { 
        for (const name in activeHandlers) {
            if (name === myName) continue;
            if (!allowed || allowed.indexOf(name) < 0) {
                assert(activeHandlers[name].active, 'isreally');
                //log("BLOCKER" + name);
                return true;
            }
        }
        return false;
    }

    processInputEvent(e: InputEvent) {
        //log('', true);
        // TODO
        if (e.cancelable && (e instanceof MouseEvent ? e.type === 'mousemove' : true)) e.preventDefault();
        let transformSettings = {};
        let activeHandlers = {};

        let points = e.touches ?
            DOM.touchPos(this._el, e) :
            DOM.mousePos(this._el, e);

        try {
        for (const [name, handler, allowed] of this._handlers) {
            if (!handler.isEnabled()) continue;

            if (this.blockedByActive(activeHandlers, allowed, name)) {
                handler.reset();

            } else {
                let data = handler.processInputEvent(e, points);
                if (data && data.transform) {
                    extend(transformSettings, data.transform);
                }
            }

            if (handler.active) {
                activeHandlers[name] = handler;
            } else {
                delete activeHandlers[name];
            }
        }
        } catch(e) {
            log(e);
        }

        //log('active' + Object.keys(activeHandlers));
        if (Object.keys(transformSettings).length) {
            this.updateMapTransform(transformSettings);
        }

        const wasActive = this.isActive;
        this.isActive = Boolean(Object.keys(activeHandlers).length);
        if (wasActive && !this.active) this.inertia._onMoveEnd(e);
    }

    updateMapTransform(settings: Object) {
        const map = this._map;
        this._map.stop();

        let { zoomDelta, bearingDelta, pitchDelta, setLocationAtPoint, around, panDelta } = settings;
        if (settings.duration) {
            const easeOptions = {
                duration: settings.duration,
                delayEndEvents: settings.delayEndEvents,
                easing: settings.easing
            };

            if (zoomDelta) {
                easeOptions.zoom = map.getZoom() + zoomDelta;
            }

            if (panDelta) {
                console.log(map.project(map.getCenter()), panDelta);
                easeOptions.center = map.unproject(map.project(map.getCenter()).sub(panDelta));
            }

            if (pitchDelta) {
            }

            map.easeTo(easeOptions);
            return;
        }


        const tr = this._map.transform;
        this.inertia.record(settings);

        if (zoomDelta) tr.zoom += zoomDelta;
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
    }

}


export default HandlerManager;
