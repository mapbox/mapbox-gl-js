// @flow

import {Event} from '../util/evented.js';
import * as DOM from '../util/dom.js';
import type Map from './map.js';
import HandlerInertia from './handler_inertia.js';
import {MapEventHandler, BlockableMapEventHandler} from './handler/map_event.js';
import BoxZoomHandler from './handler/box_zoom.js';
import TapZoomHandler from './handler/tap_zoom.js';
import {MousePanHandler, MouseRotateHandler, MousePitchHandler} from './handler/mouse.js';
import TouchPanHandler from './handler/touch_pan.js';
import {TouchZoomHandler, TouchRotateHandler, TouchPitchHandler} from './handler/touch_zoom_rotate.js';
import KeyboardHandler from './handler/keyboard.js';
import ScrollZoomHandler from './handler/scroll_zoom.js';
import DoubleClickZoomHandler from './handler/shim/dblclick_zoom.js';
import ClickZoomHandler from './handler/click_zoom.js';
import TapDragZoomHandler from './handler/tap_drag_zoom.js';
import DragPanHandler from './handler/shim/drag_pan.js';
import DragRotateHandler from './handler/shim/drag_rotate.js';
import TouchZoomRotateHandler from './handler/shim/touch_zoom_rotate.js';
import {bindAll, extend} from '../util/util.js';
import window from '../util/window.js';
import Point from '@mapbox/point-geometry';
import assert from 'assert';
import {vec3} from 'gl-matrix';
import MercatorCoordinate, {latFromMercatorY, mercatorScale} from '../geo/mercator_coordinate.js';

import type {Vec3} from 'gl-matrix';

export type InputEvent = MouseEvent | TouchEvent | KeyboardEvent | WheelEvent;

const isMoving = (p: { [string]: any }) => p.zoom || p.drag || p.pitch || p.rotate;

class RenderFrameEvent extends Event {
    type: 'renderFrame';
    timeStamp: number;
}

class TrackingEllipsoid {
    constants: Array<number>;
    radius: number;

    constructor() {
        // a, b, c in the equation x²/a² + y²/b² + z²/c² = 1
        this.constants = [1, 1, 0.01];
        this.radius = 0;
    }

    setup(center: Vec3, pointOnSurface: Vec3) {
        const centerToSurface = vec3.sub([], pointOnSurface, center);
        if (centerToSurface[2] < 0) {
            this.radius = vec3.length(vec3.div([], centerToSurface, this.constants));
        } else {
            // The point on surface is above the center. This can happen for example when the camera is
            // below the clicked point (like a mountain) Use slightly shorter radius for less aggressive movement
            this.radius = vec3.length([centerToSurface[0], centerToSurface[1], 0]);
        }
    }

    // Cast a ray from the center of the ellipsoid and the intersection point.
    projectRay(dir: Vec3): Vec3 {
        // Perform the intersection test against a unit sphere
        vec3.div(dir, dir, this.constants);
        vec3.normalize(dir, dir);
        vec3.mul(dir, dir, this.constants);

        const intersection = vec3.scale([], dir, this.radius);

        if (intersection[2] > 0) {
            // The intersection point is above horizon so special handling is required.
            // Otherwise direction of the movement would be inverted due to the ellipsoid shape
            const h = vec3.scale([], [0, 0, 1], vec3.dot(intersection, [0, 0, 1]));
            const r = vec3.scale([], vec3.normalize([], [intersection[0], intersection[1], 0]), this.radius);
            const p = vec3.add([], intersection, vec3.scale([], vec3.sub([], vec3.add([], r, h), intersection), 2));

            intersection[0] = p[0];
            intersection[1] = p[1];
        }

        return intersection;
    }
}

// Handlers interpret dom events and return camera changes that should be
// applied to the map (`HandlerResult`s). The camera changes are all deltas.
// The handler itself should have no knowledge of the map's current state.
// This makes it easier to merge multiple results and keeps handlers simpler.
// For example, if there is a mousedown and mousemove, the mousePan handler
// would return a `panDelta` on the mousemove.
export interface Handler {
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    isActive(): boolean;

    // `reset` can be called by the manager at any time and must reset everything to it's original state
    reset(): void;

    // Handlers can optionally implement these methods.
    // They are called with dom events whenever those dom evens are received.
    +touchstart?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult;
    +touchmove?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult;
    +touchend?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult;
    +touchcancel?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult;
    +mousedown?: (e: MouseEvent, point: Point) => ?HandlerResult;
    +mousemove?: (e: MouseEvent, point: Point) => ?HandlerResult;
    +mouseup?: (e: MouseEvent, point: Point) => ?HandlerResult;
    +dblclick?: (e: MouseEvent, point: Point) => ?HandlerResult;
    +wheel?: (e: WheelEvent, point: Point) => ?HandlerResult;
    +keydown?: (e: KeyboardEvent) => ?HandlerResult;
    +keyup?: (e: KeyboardEvent) => ?HandlerResult;

    // `renderFrame` is the only non-dom event. It is called during render
    // frames and can be used to smooth camera changes (see scroll handler).
    +renderFrame?: () => ?HandlerResult;
}

// All handler methods that are called with events can optionally return a `HandlerResult`.
export type HandlerResult = {
    panDelta?: Point,
    zoomDelta?: number,
    bearingDelta?: number,
    pitchDelta?: number,
    // the point to not move when changing the camera
    around?: Point | null,
    // same as above, except for pinch actions, which are given higher priority
    pinchAround?: Point | null,
    // the point to not move when changing the camera in mercator coordinates
    aroundCoord?: MercatorCoordinate | null,
    // A method that can fire a one-off easing by directly changing the map's camera.
    cameraAnimation?: (map: Map) => any;

    // The last three properties are needed by only one handler: scrollzoom.
    // The DOM event to be used as the `originalEvent` on any camera change events.
    originalEvent?: any,
    // Makes the manager trigger a frame, allowing the handler to return multiple results over time (see scrollzoom).
    needsRenderFrame?: boolean,
    // The camera changes won't get recorded for inertial zooming.
    noInertia?: boolean
};

function hasChange(result: HandlerResult) {
    return (result.panDelta && result.panDelta.mag()) || result.zoomDelta || result.bearingDelta || result.pitchDelta;
}

class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<{ handlerName: string, handler: Handler, allowed: any }>;
    _eventsInProgress: Object;
    _frameId: ?number;
    _inertia: HandlerInertia;
    _bearingSnap: number;
    _handlersById: { [string]: Handler };
    _updatingCamera: boolean;
    _changes: Array<[HandlerResult, Object, any]>;
    _previousActiveHandlers: { [string]: Handler };
    _listeners: Array<[HTMLElement, string, void | EventListenerOptionsOrUseCapture]>;
    _trackingEllipsoid: TrackingEllipsoid;
    _dragOrigin: ?Vec3;

    constructor(map: Map, options: { interactive: boolean, pitchWithRotate: boolean, clickTolerance: number, bearingSnap: number}) {
        this._map = map;
        this._el = this._map.getCanvasContainer();
        this._handlers = [];
        this._handlersById = {};
        this._changes = [];

        this._inertia = new HandlerInertia(map);
        this._bearingSnap = options.bearingSnap;
        this._previousActiveHandlers = {};
        this._trackingEllipsoid = new TrackingEllipsoid();
        this._dragOrigin = null;

        // Track whether map is currently moving, to compute start/move/end events
        this._eventsInProgress = {};

        this._addDefaultHandlers(options);

        bindAll(['handleEvent', 'handleWindowEvent'], this);

        const el = this._el;

        this._listeners = [
            // This needs to be `passive: true` so that a double tap fires two
            // pairs of touchstart/end events in iOS Safari 13. If this is set to
            // `passive: false` then the second pair of events is only fired if
            // preventDefault() is called on the first touchstart. Calling preventDefault()
            // undesirably prevents click events.
            [el, 'touchstart', {passive: true}],
            // This needs to be `passive: false` so that scrolls and pinches can be
            // prevented in browsers that don't support `touch-actions: none`, for example iOS Safari 12.
            [el, 'touchmove', {passive: false}],
            [el, 'touchend', undefined],
            [el, 'touchcancel', undefined],

            [el, 'mousedown', undefined],
            [el, 'mousemove', undefined],
            [el, 'mouseup', undefined],

            // Bind window-level event listeners for move and up/end events. In the absence of
            // the pointer capture API, which is not supported by all necessary platforms,
            // window-level event listeners give us the best shot at capturing events that
            // fall outside the map canvas element. Use `{capture: true}` for the move event
            // to prevent map move events from being fired during a drag.
            [window.document, 'mousemove', {capture: true}],
            [window.document, 'mouseup', undefined],

            [el, 'mouseover', undefined],
            [el, 'mouseout', undefined],
            [el, 'dblclick', undefined],
            [el, 'click', undefined],

            [el, 'keydown', {capture: false}],
            [el, 'keyup', undefined],

            [el, 'wheel', {passive: false}],
            [el, 'contextmenu', undefined],

            [window, 'blur', undefined]
        ];

        for (const [target, type, listenerOptions] of this._listeners) {
            // $FlowFixMe[method-unbinding]
            const listener = target === window.document ? this.handleWindowEvent : this.handleEvent;
            target.addEventListener((type: any), (listener: any), listenerOptions);
        }
    }

    destroy() {
        for (const [target, type, listenerOptions] of this._listeners) {
            // $FlowFixMe[method-unbinding]
            const listener = target === window.document ? this.handleWindowEvent : this.handleEvent;
            target.removeEventListener((type: any), (listener: any), listenerOptions);
        }
    }

    _addDefaultHandlers(options: { interactive: boolean, pitchWithRotate: boolean, clickTolerance: number }) {
        const map = this._map;
        const el = map.getCanvasContainer();
        // $FlowFixMe[method-unbinding]
        this._add('mapEvent', new MapEventHandler(map, options));

        const boxZoom = map.boxZoom = new BoxZoomHandler(map, options);
        // $FlowFixMe[method-unbinding]
        this._add('boxZoom', boxZoom);

        const tapZoom = new TapZoomHandler();
        const clickZoom = new ClickZoomHandler();
        map.doubleClickZoom = new DoubleClickZoomHandler(clickZoom, tapZoom);
        // $FlowFixMe[method-unbinding]
        this._add('tapZoom', tapZoom);
        // $FlowFixMe[method-unbinding]
        this._add('clickZoom', clickZoom);

        const tapDragZoom = new TapDragZoomHandler();
        // $FlowFixMe[method-unbinding]
        this._add('tapDragZoom', tapDragZoom);

        const touchPitch = map.touchPitch = new TouchPitchHandler(map);
        // $FlowFixMe[method-unbinding]
        this._add('touchPitch', touchPitch);

        const mouseRotate = new MouseRotateHandler(options);
        const mousePitch = new MousePitchHandler(options);
        map.dragRotate = new DragRotateHandler(options, mouseRotate, mousePitch);
        // $FlowFixMe[method-unbinding]
        this._add('mouseRotate', mouseRotate, ['mousePitch']);
        // $FlowFixMe[method-unbinding]
        this._add('mousePitch', mousePitch, ['mouseRotate']);

        const mousePan = new MousePanHandler(options);
        const touchPan = new TouchPanHandler(map, options);
        map.dragPan = new DragPanHandler(el, mousePan, touchPan);
        // $FlowFixMe[method-unbinding]
        this._add('mousePan', mousePan);
        // $FlowFixMe[method-unbinding]
        this._add('touchPan', touchPan, ['touchZoom', 'touchRotate']);

        const touchRotate = new TouchRotateHandler();
        const touchZoom = new TouchZoomHandler();
        map.touchZoomRotate = new TouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);
        // $FlowFixMe[method-unbinding]
        this._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
        // $FlowFixMe[method-unbinding]
        this._add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);

        // $FlowFixMe[method-unbinding]
        this._add('blockableMapEvent', new BlockableMapEventHandler(map));

        const scrollZoom = map.scrollZoom = new ScrollZoomHandler(map, this);
        // $FlowFixMe[method-unbinding]
        this._add('scrollZoom', scrollZoom, ['mousePan']);

        const keyboard = map.keyboard = new KeyboardHandler();
        // $FlowFixMe[method-unbinding]
        this._add('keyboard', keyboard);

        for (const name of ['boxZoom', 'doubleClickZoom', 'tapDragZoom', 'touchPitch', 'dragRotate', 'dragPan', 'touchZoomRotate', 'scrollZoom', 'keyboard']) {
            if (options.interactive && (options: any)[name]) {
                (map: any)[name].enable((options: any)[name]);
            }
        }
    }

    _add(handlerName: string, handler: Handler, allowed?: Array<string>) {
        this._handlers.push({handlerName, handler, allowed});
        this._handlersById[handlerName] = handler;
    }

    stop(allowEndAnimation: boolean) {
        // do nothing if this method was triggered by a gesture update
        if (this._updatingCamera) return;

        for (const {handler} of this._handlers) {
            handler.reset();
        }
        this._inertia.clear();
        this._fireEvents({}, {}, allowEndAnimation);
        this._changes = [];
    }

    isActive(): boolean {
        for (const {handler} of this._handlers) {
            if (handler.isActive()) return true;
        }
        return false;
    }

    isZooming(): boolean {
        return !!this._eventsInProgress.zoom || this._map.scrollZoom.isZooming();
    }

    isRotating(): boolean {
        return !!this._eventsInProgress.rotate;
    }

    isMoving(): boolean {
        return !!isMoving(this._eventsInProgress) || this.isZooming();
    }

    _isDragging(): boolean {
        return !!this._eventsInProgress.drag;
    }

    _blockedByActive(activeHandlers: { [string]: Handler }, allowed: Array<string>, myName: string): boolean {
        for (const name in activeHandlers) {
            if (name === myName) continue;
            if (!allowed || allowed.indexOf(name) < 0) {
                return true;
            }
        }
        return false;
    }

    handleWindowEvent(e: InputEvent) {
        this.handleEvent(e, `${e.type}Window`);
    }

    _getMapTouches(touches: TouchList): TouchList {
        const mapTouches = [];
        for (const t of touches) {
            const target = ((t.target: any): Node);
            if (this._el.contains(target)) {
                mapTouches.push(t);
            }
        }
        return ((mapTouches: any): TouchList);
    }

    handleEvent(e: InputEvent | RenderFrameEvent, eventName?: string) {

        this._updatingCamera = true;
        assert(e.timeStamp !== undefined);

        const isRenderFrame = e.type === 'renderFrame';
        const inputEvent = isRenderFrame ? undefined : ((e: any): InputEvent);

        /*
         * We don't call e.preventDefault() for any events by default.
         * Handlers are responsible for calling it where necessary.
         */

        const mergedHandlerResult: HandlerResult = {needsRenderFrame: false};
        const eventsInProgress = {};
        const activeHandlers = {};

        const mapTouches = e.touches ? this._getMapTouches(((e: any): TouchEvent).touches) : undefined;
        const points = mapTouches ? DOM.touchPos(this._el, mapTouches) :
            isRenderFrame ? undefined : // renderFrame event doesn't have any points
            DOM.mousePos(this._el, ((e: any): MouseEvent));

        for (const {handlerName, handler, allowed} of this._handlers) {
            if (!handler.isEnabled()) continue;

            let data: ?HandlerResult;
            if (this._blockedByActive(activeHandlers, allowed, handlerName)) {
                handler.reset();

            } else {
                if ((handler: any)[eventName || e.type]) {
                    data = (handler: any)[eventName || e.type](e, points, mapTouches);
                    this.mergeHandlerResult(mergedHandlerResult, eventsInProgress, data, handlerName, inputEvent);
                    if (data && data.needsRenderFrame) {
                        this._triggerRenderFrame();
                    }
                }
            }

            if (data || handler.isActive()) {
                activeHandlers[handlerName] = handler;
            }
        }

        const deactivatedHandlers = {};
        for (const name in this._previousActiveHandlers) {
            if (!activeHandlers[name]) {
                deactivatedHandlers[name] = inputEvent;
            }
        }
        this._previousActiveHandlers = activeHandlers;

        if (Object.keys(deactivatedHandlers).length || hasChange(mergedHandlerResult)) {
            this._changes.push([mergedHandlerResult, eventsInProgress, deactivatedHandlers]);
            this._triggerRenderFrame();
        }

        if (Object.keys(activeHandlers).length || hasChange(mergedHandlerResult)) {
            this._map._stop(true);
        }

        this._updatingCamera = false;

        const {cameraAnimation} = mergedHandlerResult;
        if (cameraAnimation) {
            this._inertia.clear();
            this._fireEvents({}, {}, true);
            this._changes = [];
            cameraAnimation(this._map);
        }
    }

    mergeHandlerResult(mergedHandlerResult: HandlerResult, eventsInProgress: Object, handlerResult: HandlerResult, name: string, e?: InputEvent) {
        if (!handlerResult) return;

        extend(mergedHandlerResult, handlerResult);

        const eventData = {handlerName: name, originalEvent: handlerResult.originalEvent || e};

        // track which handler changed which camera property
        if (handlerResult.zoomDelta !== undefined) {
            eventsInProgress.zoom = eventData;
        }
        if (handlerResult.panDelta !== undefined) {
            eventsInProgress.drag = eventData;
        }
        if (handlerResult.pitchDelta !== undefined) {
            eventsInProgress.pitch = eventData;
        }
        if (handlerResult.bearingDelta !== undefined) {
            eventsInProgress.rotate = eventData;
        }
    }

    _applyChanges() {
        const combined = {};
        const combinedEventsInProgress = {};
        const combinedDeactivatedHandlers = {};

        for (const [change, eventsInProgress, deactivatedHandlers] of this._changes) {

            if (change.panDelta) combined.panDelta = (combined.panDelta || new Point(0, 0))._add(change.panDelta);
            if (change.zoomDelta) combined.zoomDelta = (combined.zoomDelta || 0) + change.zoomDelta;
            if (change.bearingDelta) combined.bearingDelta = (combined.bearingDelta || 0) + change.bearingDelta;
            if (change.pitchDelta) combined.pitchDelta = (combined.pitchDelta || 0) + change.pitchDelta;
            if (change.around !== undefined) combined.around = change.around;
            if (change.aroundCoord !== undefined) combined.aroundCoord = change.aroundCoord;
            if (change.pinchAround !== undefined) combined.pinchAround = change.pinchAround;
            if (change.noInertia) combined.noInertia = change.noInertia;

            extend(combinedEventsInProgress, eventsInProgress);
            extend(combinedDeactivatedHandlers, deactivatedHandlers);
        }

        this._updateMapTransform(combined, combinedEventsInProgress, combinedDeactivatedHandlers);
        this._changes = [];
    }

    _updateMapTransform(combinedResult: any, combinedEventsInProgress: Object, deactivatedHandlers: Object) {

        const map = this._map;
        const tr = map.transform;

        const eventStarted = (type: string) => {
            const newEvent = combinedEventsInProgress[type];
            return newEvent && !this._eventsInProgress[type];
        };

        const eventEnded = (type: string) => {
            const event = this._eventsInProgress[type];
            return event && !this._handlersById[event.handlerName].isActive();
        };

        const toVec3 = (p: MercatorCoordinate): Vec3 => [p.x, p.y, p.z];

        if (eventEnded("drag") && !hasChange(combinedResult)) {
            const preZoom = tr.zoom;
            tr.cameraElevationReference = "sea";
            tr.recenterOnTerrain();
            tr.cameraElevationReference = "ground";
            // Map zoom might change during the pan operation due to terrain elevation.
            if (preZoom !== tr.zoom) this._map._update(true);
        }

        // Catches double click and double tap zooms when camera is constrained over terrain
        if (tr._isCameraConstrained) map._stop(true);

        if (!hasChange(combinedResult)) {
            this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true);
            return;
        }

        let {panDelta, zoomDelta, bearingDelta, pitchDelta, around, aroundCoord, pinchAround} = combinedResult;

        if (tr._isCameraConstrained) {
            // Catches wheel zoom events when camera is constrained over terrain
            if (zoomDelta > 0) zoomDelta = 0;
            tr._isCameraConstrained = false;
        }

        if (pinchAround !== undefined) {
            around = pinchAround;
        }

        if ((zoomDelta || eventStarted("drag")) && around) {
            this._dragOrigin = toVec3(tr.pointCoordinate3D(around));
            // Construct the tracking ellipsoid every time user changes the zoom or drag origin.
            // Direction of the ray will define size of the shape and hence defining the available range of movement
            this._trackingEllipsoid.setup(tr._camera.position, this._dragOrigin);
        }

        // All movement of the camera is done relative to the sea level
        tr.cameraElevationReference = "sea";

        // stop any ongoing camera animations (easeTo, flyTo)
        map._stop(true);

        around = around || map.transform.centerPoint;
        if (bearingDelta) tr.bearing += bearingDelta;
        if (pitchDelta) tr.pitch += pitchDelta;
        tr._updateCameraState();

        // Compute Mercator 3D camera offset based on screenspace panDelta
        const panVec = [0, 0, 0];
        if (panDelta) {
            if (tr.projection.name === 'mercator') {
                assert(this._dragOrigin, '_dragOrigin should have been setup with a previous dragstart');
                const startPoint = this._trackingEllipsoid.projectRay(tr.screenPointToMercatorRay(around).dir);
                const endPoint = this._trackingEllipsoid.projectRay(tr.screenPointToMercatorRay(around.sub(panDelta)).dir);
                panVec[0] = endPoint[0] - startPoint[0];
                panVec[1] = endPoint[1] - startPoint[1];

            } else {
                const startPoint = tr.pointCoordinate(around);
                if (tr.projection.name === 'globe') {
                    // Compute pan vector directly in pixel coordinates for the globe.
                    // Rotate the globe a bit faster when dragging near poles to compensate
                    // different pixel-per-meter ratios (ie. pixel-to-physical-rotation is lower)
                    panDelta = panDelta.rotate(-tr.angle);
                    const scale = tr._pixelsPerMercatorPixel / tr.worldSize;
                    panVec[0] = -panDelta.x * mercatorScale(latFromMercatorY(startPoint.y)) * scale;
                    panVec[1] = -panDelta.y * mercatorScale(tr.center.lat) * scale;

                } else {
                    const endPoint = tr.pointCoordinate(around.sub(panDelta));

                    if (startPoint && endPoint) {
                        panVec[0] = endPoint.x - startPoint.x;
                        panVec[1] = endPoint.y - startPoint.y;
                    }
                }
            }
        }

        const originalZoom = tr.zoom;
        // Compute Mercator 3D camera offset based on screenspace requested ZoomDelta
        const zoomVec = [0, 0, 0];
        if (zoomDelta) {
            // Zoom value has to be computed relative to a secondary map plane that is created from the terrain position below the cursor.
            // This way the zoom interpolation can be kept linear and independent of the (possible) terrain elevation
            const pickedPosition: Vec3 = aroundCoord ? toVec3(aroundCoord) : toVec3(tr.pointCoordinate3D(around));

            const aroundRay = {dir: vec3.normalize([], vec3.sub([], pickedPosition, tr._camera.position))};
            if (aroundRay.dir[2] < 0) {
                // Special handling is required if the ray created from the cursor is heading up.
                // This scenario is possible if user is trying to zoom towards a feature like a hill or a mountain.
                // Convert zoomDelta to a movement vector as if the camera would be orbiting around the picked point
                const movement = tr.zoomDeltaToMovement(pickedPosition, zoomDelta);
                vec3.scale(zoomVec, aroundRay.dir, movement);
            }
        }

        // Mutate camera state via CameraAPI
        const translation = vec3.add(panVec, panVec, zoomVec);
        tr._translateCameraConstrained(translation);

        if (zoomDelta && Math.abs(tr.zoom - originalZoom) > 0.0001) {
            tr.recenterOnTerrain();
        }

        tr.cameraElevationReference = "ground";

        this._map._update();
        if (!combinedResult.noInertia) this._inertia.record(combinedResult);
        this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true);
    }

    _fireEvents(newEventsInProgress: { [string]: Object }, deactivatedHandlers: Object, allowEndAnimation: boolean) {

        const wasMoving = isMoving(this._eventsInProgress);
        const nowMoving = isMoving(newEventsInProgress);

        const startEvents = {};

        for (const eventName in newEventsInProgress) {
            const {originalEvent} = newEventsInProgress[eventName];
            if (!this._eventsInProgress[eventName]) {
                startEvents[`${eventName}start`] = originalEvent;
            }
            this._eventsInProgress[eventName] = newEventsInProgress[eventName];
        }

        // fire start events only after this._eventsInProgress has been updated
        if (!wasMoving && nowMoving) {
            this._fireEvent('movestart', nowMoving.originalEvent);
        }

        for (const name in startEvents) {
            this._fireEvent(name, startEvents[name]);
        }

        if (nowMoving) {
            this._fireEvent('move', nowMoving.originalEvent);
        }

        for (const eventName in newEventsInProgress) {
            const {originalEvent} = newEventsInProgress[eventName];
            this._fireEvent(eventName, originalEvent);
        }

        const endEvents = {};

        let originalEndEvent;
        for (const eventName in this._eventsInProgress) {
            const {handlerName, originalEvent} = this._eventsInProgress[eventName];
            if (!this._handlersById[handlerName].isActive()) {
                delete this._eventsInProgress[eventName];
                originalEndEvent = deactivatedHandlers[handlerName] || originalEvent;
                endEvents[`${eventName}end`] = originalEndEvent;
            }
        }

        for (const name in endEvents) {
            this._fireEvent(name, endEvents[name]);
        }

        const stillMoving = isMoving(this._eventsInProgress);
        if (allowEndAnimation && (wasMoving || nowMoving) && !stillMoving) {
            this._updatingCamera = true;
            const inertialEase = this._inertia._onMoveEnd(this._map.dragPan._inertiaOptions);

            const shouldSnapToNorth = (bearing: number) => bearing !== 0 && -this._bearingSnap < bearing && bearing < this._bearingSnap;

            if (inertialEase) {
                if (shouldSnapToNorth(inertialEase.bearing || this._map.getBearing())) {
                    inertialEase.bearing = 0;
                }
                this._map.easeTo(inertialEase, {originalEvent: originalEndEvent});
            } else {
                this._map.fire(new Event('moveend', {originalEvent: originalEndEvent}));
                if (shouldSnapToNorth(this._map.getBearing())) {
                    this._map.resetNorth();
                }
            }
            this._updatingCamera = false;
        }

    }

    _fireEvent(type: string, e: any) {
        this._map.fire(new Event(type, e ? {originalEvent: e} : {}));
    }

    _requestFrame(): number {
        this._map.triggerRepaint();
        return this._map._renderTaskQueue.add(timeStamp => {
            this._frameId = undefined;
            this.handleEvent(new RenderFrameEvent('renderFrame', {timeStamp}));
            this._applyChanges();
        });
    }

    _triggerRenderFrame() {
        if (this._frameId === undefined) {
            this._frameId = this._requestFrame();
        }
    }
}

export default HandlerManager;
