// @flow

import type Map from './map.js';
import type Point from '@mapbox/point-geometry';
import type MercatorCoordinate from '../geo/mercator_coordinate.js';

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
    +touchstart?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult | void;
    +touchmove?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult | void;
    +touchend?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult | void;
    +touchcancel?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => ?HandlerResult | void;
    +mousedown?: (e: MouseEvent, point: Point) => ?HandlerResult | void;
    +mousemove?: (e: MouseEvent, point: Point) => ?HandlerResult | void;
    +mouseup?: (e: MouseEvent, point: Point) => ?HandlerResult | void;
    +dblclick?: (e: MouseEvent, point: Point) => ?HandlerResult | void;
    +wheel?: (e: WheelEvent, point: Point) => ?HandlerResult | void;
    +keydown?: (e: KeyboardEvent) => ?HandlerResult | void;
    +keyup?: (e: KeyboardEvent) => ?HandlerResult | void;

    // `renderFrame` is the only non-dom event. It is called during render
    // frames and can be used to smooth camera changes (see scroll handler).
    +renderFrame?: () => ?HandlerResult | void;
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
