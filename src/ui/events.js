// @flow

import {Event} from '../util/evented';

import DOM from '../util/dom';
import Point from '@mapbox/point-geometry';
import {extend} from '../util/util';

import type Map from './map';
import type LngLat from '../geo/lng_lat';

/**
 * `MapMouseEvent` is the event type for mouse-related map events.
 * @extends {Object}
 * @example
 * // The `click` event is an example of a `MapMouseEvent`.
 * // Set up an event listener on the map.
 * map.on('click', function(e) {
 *   // The event object (e) contains information like the
 *   // coordinates of the point on the map that was clicked.
 *   console.log('A click event has occurred at ' + e.lngLat);
 * });
 */
export class MapMouseEvent extends Event {
    /**
     * The event type (one of {@link Map.event:mousedown},
     * {@link Map.event:mouseup},
     * {@link Map.event:click},
     * {@link Map.event:dblclick},
     * {@link Map.event:mousemove},
     * {@link Map.event:mouseover},
     * {@link Map.event:mouseenter},
     * {@link Map.event:mouseleave},
     * {@link Map.event:mouseout},
     * {@link Map.event:contextmenu}).
     */
    type: 'mousedown'
        | 'mouseup'
        | 'click'
        | 'dblclick'
        | 'mousemove'
        | 'mouseover'
        | 'mouseenter'
        | 'mouseleave'
        | 'mouseout'
        | 'contextmenu';

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: MouseEvent;

    /**
     * The pixel coordinates of the mouse cursor, relative to the map and measured from the top left corner.
     */
    point: Point;

    /**
     * The geographic location on the map of the mouse cursor.
     */
    lngLat: LngLat;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the following default map behaviors:
     *
     *   * On `mousedown` events, the behavior of {@link DragPanHandler}
     *   * On `mousedown` events, the behavior of {@link DragRotateHandler}
     *   * On `mousedown` events, the behavior of {@link BoxZoomHandler}
     *   * On `dblclick` events, the behavior of {@link DoubleClickZoomHandler}
     *
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     * @private
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    /**
     * @private
     */
    constructor(type: string, map: Map, originalEvent: MouseEvent, data: Object = {}) {
        const point = DOM.mousePos(map.getCanvasContainer(), originalEvent);
        const lngLat = map.unproject(point);
        super(type, extend({point, lngLat, originalEvent}, data));
        this._defaultPrevented = false;
        this.target = map;
    }
}

/**
 * `MapTouchEvent` is the event type for touch-related map events.
 * @extends {Object}
 */
export class MapTouchEvent extends Event {
    /**
     * The event type.
     */
    type: 'touchstart'
        | 'touchend'
        | 'touchcancel';

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: TouchEvent;

    /**
     * The geographic location on the map of the center of the touch event points.
     */
    lngLat: LngLat;

    /**
     * The pixel coordinates of the center of the touch event points, relative to the map and measured from the top left
     * corner.
     */
    point: Point;

    /**
     * The array of pixel coordinates corresponding to a
     * [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches) property.
     */
    points: Array<Point>;

    /**
     * The geographical locations on the map corresponding to a
     * [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches) property.
     */
    lngLats: Array<LngLat>;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the following default map behaviors:
     *
     *   * On `touchstart` events, the behavior of {@link DragPanHandler}
     *   * On `touchstart` events, the behavior of {@link TouchZoomRotateHandler}
     *
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     * @private
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    /**
     * @private
     */
    constructor(type: string, map: Map, originalEvent: TouchEvent) {
        const touches = type === "touchend" ? originalEvent.changedTouches : originalEvent.touches;
        const points = DOM.touchPos(map.getCanvasContainer(), touches);
        const lngLats = points.map((t) => map.unproject(t));
        const point = points.reduce((prev, curr, i, arr) => {
            return prev.add(curr.div(arr.length));
        }, new Point(0, 0));
        const lngLat = map.unproject(point);
        super(type, {points, point, lngLats, lngLat, originalEvent});
        this._defaultPrevented = false;
    }
}

/**
 * `MapWheelEvent` is the event type for the `wheel` map event.
 * @extends {Object}
 */
export class MapWheelEvent extends Event {
    /**
     * The event type.
     */
    type: 'wheel';

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: WheelEvent;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the the behavior of {@link ScrollZoomHandler}.
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     * @private
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    /**
     * @private
     */
    constructor(type: string, map: Map, originalEvent: WheelEvent) {
        super(type, {originalEvent});
        this._defaultPrevented = false;
    }
}

/**
 * A `MapBoxZoomEvent` is the event type for the boxzoom-related map events emitted by the {@link BoxZoomHandler}.
 *
 * @typedef {Object} MapBoxZoomEvent
 * @property {MouseEvent} originalEvent The DOM event that triggered the boxzoom event. Can be a `MouseEvent` or `KeyboardEvent`
 * @property {string} type The type of boxzoom event. One of `boxzoomstart`, `boxzoomend` or `boxzoomcancel`
 * @property {Map} target The `Map` instance that triggerred the event
 */
export type MapBoxZoomEvent = {
    type: 'boxzoomstart'
        | 'boxzoomend'
        | 'boxzoomcancel',
    target: Map,
    originalEvent: MouseEvent
};

/**
 * A `MapDataEvent` object is emitted with the {@link Map.event:data}
 * and {@link Map.event:dataloading} events. Possible values for
 * `dataType`s are:
 *
 * - `'source'`: The non-tile data associated with any source
 * - `'style'`: The [style](https://www.mapbox.com/mapbox-gl-style-spec/) used by the map
 *
 * @typedef {Object} MapDataEvent
 * @property {string} type The event type.
 * @property {string} dataType The type of data that has changed. One of `'source'`, `'style'`.
 * @property {boolean} [isSourceLoaded] True if the event has a `dataType` of `source` and the source has no outstanding network requests.
 * @property {Object} [source] The [style spec representation of the source](https://www.mapbox.com/mapbox-gl-style-spec/#sources) if the event has a `dataType` of `source`.
 * @property {string} [sourceDataType] Included if the event has a `dataType` of `source` and the event signals
 * that internal data has been received or changed. Possible values are `metadata`, `content` and `visibility`.
 * @property {Object} [tile] The tile being loaded or changed, if the event has a `dataType` of `source` and
 * the event is related to loading of a tile.
 * @property {Coordinate} [coord] The coordinate of the tile if the event has a `dataType` of `source` and
 * the event is related to loading of a tile.
 * @example
 * // The sourcedata event is an example of MapDataEvent.
 * // Set up an event listener on the map.
 * map.on('sourcedata', function(e) {
 *    if (e.isSourceLoaded) {
 *        // Do something when the source has finished loading
 *    }
 * });
 */
export type MapDataEvent = {
    type: string,
    dataType: string
};

export type MapContextEvent = {
    type: 'webglcontextlost' | 'webglcontextrestored',
    originalEvent: WebGLContextEvent
}

export type MapEvent =
    /**
     * Fired when a pointing device (usually a mouse) is pressed within the map.
     *
     * **Note:** This event is compatible with the optional `layerId` parameter.
     * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
     * the cursor is pressed while inside a visible portion of the specifed layer.
     *
     * @event mousedown
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener
     * map.on('mousedown', function() {
     *   console.log('A mousedown event has occurred.');
     * });
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener for a specific layer
     * map.on('mousedown', 'poi-label', function() {
     *   console.log('A mousedown event has occurred on a visible portion of the poi-label layer.');
     * });
     * @see [Highlight features within a bounding box](https://docs.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
     * @see [Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    | 'mousedown'

    /**
     * Fired when a pointing device (usually a mouse) is released within the map.
     *
     * **Note:** This event is compatible with the optional `layerId` parameter.
     * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
     * the cursor is released while inside a visible portion of the specifed layer.
     *
     * @event mouseup
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener
     * map.on('mouseup', function() {
     *   console.log('A mouseup event has occurred.');
     * });
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener for a specific layer
     * map.on('mouseup', 'poi-label', function() {
     *   console.log('A mouseup event has occurred on a visible portion of the poi-label layer.');
     * });
     * @see [Highlight features within a bounding box](https://docs.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
     * @see [Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    | 'mouseup'

    /**
     * Fired when a pointing device (usually a mouse) is moved within the map.
     * As you move the cursor across a web page containing a map,
     * the event will fire each time it enters the map or any child elements.
     *
     * **Note:** This event is compatible with the optional `layerId` parameter.
     * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
     * the cursor is moved inside a visible portion of the specifed layer.
     *
     * @event mouseover
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener
     * map.on('mouseover', function() {
     *   console.log('A mouseover event has occurred.');
     * });
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener for a specific layer
     * map.on('mouseover', 'poi-label', function() {
     *   console.log('A mouseover event has occurred on a visible portion of the poi-label layer.');
     * });
     * @see [Get coordinates of the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/mouse-position/)
     * @see [Highlight features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/hover-styles/)
     * @see [Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     */
    | 'mouseover'

    /**
     * Fired when a pointing device (usually a mouse) is moved while the cursor is inside the map.
     * As you move the cursor across the map, the event will fire every time the cursor changes position within the map.
     *
     * **Note:** This event is compatible with the optional `layerId` parameter.
     * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
     * the cursor is inside a visible portion of the specified layer.
     *
     * @event mousemove
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener
     * map.on('mousemove', function() {
     *   console.log('A mousemove event has occurred.');
     * });
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener for a specific layer
     * map.on('mousemove', 'poi-label', function() {
     *   console.log('A mousemove event has occurred on a visible portion of the poi-label layer.');
     * });
     * @see [Get coordinates of the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/mouse-position/)
     * @see [Highlight features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/hover-styles/)
     * @see [Display a popup on over](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     */
    | 'mousemove'

    /**
     * Fired when a pointing device (usually a mouse) is pressed and released at the same point on the map.
     *
     * **Note:** This event is compatible with the optional `layerId` parameter.
     * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only when the
     * point that is pressed and released contains a visible portion of the specifed layer.
     *
     * @event click
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener
     * map.on('click', function(e) {
     *   console.log('A click event has occurred at ' + e.lngLat);
     * });
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener for a specific layer
     * map.on('click', 'poi-label', function(e) {
     *   console.log('A click event has occurred on a visible portion of the poi-label layer at ' + e.lngLat);
     * });
     * @see [Measure distances](https://www.mapbox.com/mapbox-gl-js/example/measure/)
     * @see [Center the map on a clicked symbol](https://www.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
     */
    | 'click'

    /**
     * Fired when a pointing device (usually a mouse) is pressed and released twice at the same point on
     * the map in rapid succession.
     *
     * **Note:** This event is compatible with the optional `layerId` parameter.
     * If `layerId` is included as the second argument in {@link Map#on}, the event listener will fire only
     * when the point that is clicked twice contains a visible portion of the specifed layer.
     *
     * @event dblclick
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener
     * map.on('dblclick', function(e) {
     *   console.log('A dblclick event has occurred at ' + e.lngLat);
     * });
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener for a specific layer
     * map.on('dblclick', 'poi-label', function(e) {
     *   console.log('A dblclick event has occurred on a visible portion of the poi-label layer at ' + e.lngLat);
     * });
     */
    | 'dblclick'

    /**
     * Fired when a pointing device (usually a mouse) enters a visible portion of a specified layer from
     * outside that layer or outside the map canvas.
     *
     * **Important:** This event can only be listened for when {@link Map#on} includes three arguments,
     * where the second argument specifies the desired layer.
     *
     * @event mouseenter
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener
     * map.on('mouseenter', 'water', function() {
     *   console.log('A mouseenter event occurred on a visible portion of the water layer.');
     * });
     * @see [Center the map on a clicked symbol](https://docs.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
     * @see [Display a popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
     */
    | 'mouseenter'

    /**
     * Fired when a pointing device (usually a mouse) leaves a visible portion of a specified layer, or leaves
     * the map canvas.
     *
     * **Important:** This event can only be listened for when {@link Map#on} includes three arguements,
     * where the second argument specifies the desired layer.
     *
     * @event mouseleave
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when the pointing device leaves
     * // a visible portion of the specified layer.
     * map.on('mouseleave', 'water', function() {
     *   console.log('A mouseleave event occurred.');
     * });
     * @see [Highlight features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/hover-styles/)
     * @see [Display a popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
     */
    | 'mouseleave'

    /**
     * Fired when a point device (usually a mouse) leaves the map's canvas.
     *
     * @event mouseout
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when the pointing device leave's
     * // the map's canvas.
     * map.on('mouseout', function() {
     *   console.log('A mouseout event occurred.');
     * });
     */
    | 'mouseout'

    /**
     * Fired when the right button of the mouse is clicked or the context menu key is pressed within the map.
     *
     * @event contextmenu
     * @memberof Map
     * @instance
     * @property {MapMouseEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when the right mouse button is
     * // pressed within the map.
     * map.on('contextmenu', function() {
     *   console.log('A contextmenu event occurred.');
     * });
     */
    | 'contextmenu'

    /**
     * Fired when a [`wheel`](https://developer.mozilla.org/en-US/docs/Web/Events/wheel) event occurs within the map.
     *
     * @event wheel
     * @memberof Map
     * @instance
     * @property {MapWheelEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when a wheel event occurs within the map.
     * map.on('wheel', function() {
     *   console.log('A wheel event occurred.');
     * });
     */
    | 'wheel'

    /**
     * Fired when a [`touchstart`](https://developer.mozilla.org/en-US/docs/Web/Events/touchstart) event occurs within the map.
     *
     * @event touchstart
     * @memberof Map
     * @instance
     * @property {MapTouchEvent} data
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when a touchstart event occurs within the map.
     * map.on('touchstart', function() {
     *   console.log('A touchstart event occurred.');
     * });
     * @see [Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    | 'touchstart'

    /**
     * Fired when a [`touchend`](https://developer.mozilla.org/en-US/docs/Web/Events/touchend) event occurs within the map.
     *
     * @event touchend
     * @memberof Map
     * @instance
     * @property {MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when a touchstart event occurs within the map.
     * map.on('touchstart', function() {
     *   console.log('A touchstart event occurred.');
     * });
     * @see [Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    | 'touchend'

    /**
     * Fired when a [`touchmove`](https://developer.mozilla.org/en-US/docs/Web/Events/touchmove) event occurs within the map.
     *
     * @event touchmove
     * @memberof Map
     * @instance
     * @property {MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when a touchmove event occurs within the map.
     * map.on('touchmove', function() {
     *   console.log('A touchmove event occurred.');
     * });
     * @see [Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    | 'touchmove'

    /**
     * Fired when a [`touchcancel`](https://developer.mozilla.org/en-US/docs/Web/Events/touchcancel) event occurs within the map.
     *
     * @event touchcancel
     * @memberof Map
     * @instance
     * @property {MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when a touchcancel event occurs within the map.
     * map.on('touchcancel', function() {
     *   console.log('A touchcancel event occurred.');
     * });
     */
    | 'touchcancel'

    /**
     * Fired just before the map begins a transition from one
     * view to another, as the result of either user interaction or methods such as {@link Map#jumpTo}.
     *
     * @event movestart
     * @memberof Map
     * @instance
     * @property {{originalEvent: DragEvent}} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just before the map begins a transition
     * // from one view to another.
     * map.on('movestart', function() {
     *   console.log('A movestart` event occurred.');
     * });
     */
    | 'movestart'

    /**
     * Fired repeatedly during an animated transition from one view to
     * another, as the result of either user interaction or methods such as {@link Map#flyTo}.
     *
     * @event move
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // repeatedly during an animated transition.
     * map.on('move', function() {
     *   console.log('A move event occurred.');
     * });
     * @see [Display HTML clusters with custom properties](https://docs.mapbox.com/mapbox-gl-js/example/cluster-html/)
     * @see [Filter features within map view](https://docs.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
     */
    | 'move'

    /**
     * Fired just after the map completes a transition from one
     * view to another, as the result of either user interaction or methods such as {@link Map#jumpTo}.
     *
     * @event moveend
     * @memberof Map
     * @instance
     * @property {{originalEvent: DragEvent}} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just after the map completes a transition.
     * map.on('moveend', function() {
     *   console.log('A moveend event occurred.');
     * });
     * @see [Play map locations as a slideshow](https://www.mapbox.com/mapbox-gl-js/example/playback-locations/)
     * @see [Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
     * @see [Display HTML clusters with custom properties](https://docs.mapbox.com/mapbox-gl-js/example/cluster-html/)
     */
    | 'moveend'

    /**
     * Fired when a "drag to pan" interaction starts. See {@link DragPanHandler}.
     *
     * @event dragstart
     * @memberof Map
     * @instance
     * @property {{originalEvent: DragEvent}} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when a "drag to pan" interaction starts.
     * map.on('dragstart', function() {
     *   console.log('A dragstart event occurred.');
     * });
     */
    | 'dragstart'

    /**
     * Fired repeatedly during a "drag to pan" interaction. See {@link DragPanHandler}.
     *
     * @event drag
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // repeatedly  during a "drag to pan" interaction.
     * map.on('drag', function() {
     *   console.log('A drag event occurred.');
     * });
     */
    | 'drag'

    /**
     * Fired when a "drag to pan" interaction ends. See {@link DragPanHandler}.
     *
     * @event dragend
     * @memberof Map
     * @instance
     * @property {{originalEvent: DragEvent}} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when a "drag to pan" interaction ends.
     * map.on('dragend', function() {
     *   console.log('A dragend event occurred.');
     * });
     * @see [Create a draggable marker](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-marker/)
     */
    | 'dragend'

    /**
     * Fired just before the map begins a transition from one zoom level to another,
     * as the result of either user interaction or methods such as {@link Map#flyTo}.
     *
     * @event zoomstart
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just before a zoom transition starts.
     * map.on('zoomstart', function() {
     *   console.log('A zoomstart event occurred.');
     * });
     */
    | 'zoomstart'

    /**
     * Fired repeatedly during an animated transition from one zoom level to another,
     * as the result of either user interaction or methods such as {@link Map#flyTo}.
     *
     * @event zoom
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // repeatedly during a zoom transition.
     * map.on('zoom', function() {
     *   console.log('A zoom event occurred.');
     * });
     * @see [Update a choropleth layer by zoom level](https://www.mapbox.com/mapbox-gl-js/example/updating-choropleth/)
     */
    | 'zoom'

    /**
     * Fired just after the map completes a transition from one zoom level to another,
     * as the result of either user interaction or methods such as {@link Map#flyTo}.
     *
     * @event zoomend
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just after a zoom transition finishes.
     * map.on('zoomend', function() {
     *   console.log('A zoomend event occurred.');
     * });
     */
    | 'zoomend'

    /**
     * Fired when a "drag to rotate" interaction starts. See {@link DragRotateHandler}.
     *
     * @event rotatestart
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just before a "drag to rotate" interaction starts.
     * map.on('rotatestart', function() {
     *   console.log('A rotatestart event occurred.');
     * });
     */
    | 'rotatestart'

    /**
     * Fired repeatedly during a "drag to rotate" interaction. See {@link DragRotateHandler}.
     *
     * @event rotate
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // repeatedly during "drag to rotate" interaction.
     * map.on('rotate', function() {
     *   console.log('A rotate event occurred.');
     * });
     */
    | 'rotate'

    /**
     * Fired when a "drag to rotate" interaction ends. See {@link DragRotateHandler}.
     *
     * @event rotateend
     * @memberof Map
     * @instance
     * @property {MapMouseEvent | MapTouchEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just after a "drag to rotate" interaction ends.
     * map.on('rotateend', function() {
     *   console.log('A rotateend event occurred.');
     * });
     */
    | 'rotateend'

    /**
     * Fired whenever the map's pitch (tilt) begins a change as
     * the result of either user interaction or methods such as {@link Map#flyTo} .
     *
     * @event pitchstart
     * @memberof Map
     * @instance
     * @property {MapEventData} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just before a pitch (tilt) transition starts.
     * map.on('pitchstart', function() {
     *   console.log('A pitchstart event occurred.');
     * });
     */
    | 'pitchstart'

    /**
     * Fired repeatedly during the map's pitch (tilt) animation between
     * one state and another as the result of either user interaction
     * or methods such as {@link Map#flyTo}.
     *
     * @event pitch
     * @memberof Map
     * @instance
     * @property {MapEventData} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // repeatedly during a pitch (tilt) transition.
     * map.on('pitch', function() {
     *   console.log('A pitch event occurred.');
     * });
     */
    | 'pitch'

    /**
     * Fired immediately after the map's pitch (tilt) finishes changing as
     * the result of either user interaction or methods such as {@link Map#flyTo}.
     *
     * @event pitchend
     * @memberof Map
     * @instance
     * @property {MapEventData} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just after a pitch (tilt) transition ends.
     * map.on('pitchend', function() {
     *   console.log('A pitchend event occurred.');
     * });
     */
    | 'pitchend'

    /**
     * Fired when a "box zoom" interaction starts. See {@link BoxZoomHandler}.
     *
     * @event boxzoomstart
     * @memberof Map
     * @instance
     * @property {MapBoxZoomEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just before a "box zoom" interaction starts.
     * map.on('boxzoomstart', function() {
     *   console.log('A boxzoomstart event occurred.');
     * });
     */
    | 'boxzoomstart'

    /**
     * Fired when a "box zoom" interaction ends.  See {@link BoxZoomHandler}.
     *
     * @event boxzoomend
     * @memberof Map
     * @instance
     * @type {Object}
     * @property {MapBoxZoomEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just after a "box zoom" interaction ends.
     * map.on('boxzoomend', function() {
     *   console.log('A boxzoomend event occurred.');
     * });
     */
    | 'boxzoomend'

    /**
     * Fired when the user cancels a "box zoom" interaction, or when the bounding box does not meet the minimum size threshold.
     * See {@link BoxZoomHandler}.
     *
     * @event boxzoomcancel
     * @memberof Map
     * @instance
     * @property {MapBoxZoomEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // the user cancels a "box zoom" interaction.
     * map.on('boxzoomcancel', function() {
     *   console.log('A boxzoomcancel event occurred.');
     * });
     */
    | 'boxzoomcancel'

    /**
     * Fired immediately after the map has been resized.
     *
     * @event resize
     * @memberof Map
     * @instance
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // immediately after the map has been resized.
     * map.on('resize', function() {
     *   console.log('A resize event occurred.');
     * });
     */
    | 'resize'

    /**
     * Fired when the WebGL context is lost.
     *
     * @event webglcontextlost
     * @memberof Map
     * @instance
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when the WebGL context is lost.
     * map.on('webglcontextlost', function() {
     *   console.log('A webglcontextlost event occurred.');
     * });
     */
    | 'webglcontextlost'

    /**
     * Fired when the WebGL context is restored.
     *
     * @event webglcontextrestored
     * @memberof Map
     * @instance
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when the WebGL context is restored.
     * map.on('webglcontextrestored', function() {
     *   console.log('A webglcontextrestored event occurred.');
     * });
     */
    | 'webglcontextrestored'

    /**
     * Fired immediately after all necessary resources have been downloaded
     * and the first visually complete rendering of the map has occurred.
     *
     * @event load
     * @memberof Map
     * @instance
     * @type {Object}
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when the map has finished loading.
     * map.on('load', function() {
     *   console.log('A load event occurred.');
     * });
     * @see [Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
     * @see [Add live realtime data](https://www.mapbox.com/mapbox-gl-js/example/live-geojson/)
     * @see [Animate a point](https://www.mapbox.com/mapbox-gl-js/example/animate-point-along-line/)
     */
    | 'load'

    /**
     * Fired whenever the map is drawn to the screen, as the result of
     *
     * - a change to the map's position, zoom, pitch, or bearing
     * - a change to the map's style
     * - a change to a GeoJSON source
     * - the loading of a vector tile, GeoJSON file, glyph, or sprite
     *
     * @event render
     * @memberof Map
     * @instance
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // whenever the map is drawn to the screen.
     * map.on('render', function() {
     *   console.log('A render event occurred.');
     * });
     */
    | 'render'

    /**
     * Fired after the last frame rendered before the map enters an
     * "idle" state:
     *
     * - No camera transitions are in progress
     * - All currently requested tiles have loaded
     * - All fade/transition animations have completed
     *
     * @event idle
     * @memberof Map
     * @instance
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just before the map enters an "idle" state.
     * map.on('idle', function() {
     *   console.log('A idle event occurred.');
     * });
     */
    | 'idle'

    /**
     * Fired immediately after the map has been removed with {@link Map.event:remove}.
     *
     * @event remove
     * @memberof Map
     * @instance
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // just after the map is removed.
     * map.on('remove', function() {
     *   console.log('A remove event occurred.');
     * });
     */
    | 'remove'

    /**
     * Fired when an error occurs. This is GL JS's primary error reporting
     * mechanism. We use an event instead of `throw` to better accommodate
     * asyncronous operations. If no listeners are bound to the `error` event, the
     * error will be printed to the console.
     *
     * @event error
     * @memberof Map
     * @instance
     * @property {{error: {message: string}}} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when an error occurs.
     * map.on('error', function() {
     *   console.log('A error event occurred.');
     * });
     */
    | 'error'

    /**
     * Fired when any map data loads or changes. See {@link MapDataEvent}
     * for more information.
     *
     * @event data
     * @memberof Map
     * @instance
     * @property {MapDataEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when map data loads or changes.
     * map.on('data', function() {
     *   console.log('A data event occurred.');
     * });
     * @see [Display HTML clusters with custom properties](https://docs.mapbox.com/mapbox-gl-js/example/cluster-html/)
     */
    | 'data'

    /**
     * Fired when the map's style loads or changes. See
     * {@link MapDataEvent} for more information.
     *
     * @event styledata
     * @memberof Map
     * @instance
     * @property {MapDataEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when the map's style loads or changes.
     * map.on('styledata', function() {
     *   console.log('A styledata event occurred.');
     * });
     */
    | 'styledata'

    /**
     * Fired when one of the map's sources loads or changes, including if a tile belonging
     * to a source loads or changes. See {@link MapDataEvent} for more information.
     *
     * @event sourcedata
     * @memberof Map
     * @instance
     * @property {MapDataEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when one of the map's sources loads or changes.
     * map.on('sourcedata', function() {
     *   console.log('A sourcedata event occurred.');
     * });
     */
    | 'sourcedata'

    /**
     * Fired when any map data (style, source, tile, etc) begins loading or
     * changing asyncronously. All `dataloading` events are followed by a `data`
     * or `error` event. See {@link MapDataEvent} for more information.
     *
     * @event dataloading
     * @memberof Map
     * @instance
     * @property {MapDataEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // when any map data begins loading
     * // or changing asynchronously.
     * map.on('dataloading', function() {
     *   console.log('A dataloading event occurred.');
     * });
     */
    | 'dataloading'

    /**
     * Fired when the map's style begins loading or changing asyncronously.
     * All `styledataloading` events are followed by a `styledata`
     * or `error` event. See {@link MapDataEvent} for more information.
     *
     * @event styledataloading
     * @memberof Map
     * @instance
     * @property {MapDataEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // map's style begins loading or
     * // changing asyncronously.
     * map.on('styledataloading', function() {
     *   console.log('A styledataloading event occurred.');
     * });
     */
    | 'styledataloading'

    /**
     * Fired when one of the map's sources begins loading or changing asyncronously.
     * All `sourcedataloading` events are followed by a `sourcedata` or `error` event.
     * See {@link MapDataEvent} for more information.
     *
     * @event sourcedataloading
     * @memberof Map
     * @instance
     * @property {MapDataEvent} data
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // map's sources begin loading or
     * // changing asyncronously.
     * map.on('sourcedataloading', function() {
     *   console.log('A sourcedataloading event occurred.');
     * });
     */
    | 'sourcedataloading'

    /**
     * Fired when an icon or pattern needed by the style is missing. The missing image can
     * be added with {@link Map#addImage} within this event listener callback to prevent the image from
     * being skipped. This event can be used to dynamically generate icons and patterns.
     *
     * @event styleimagemissing
     * @memberof Map
     * @instance
     * @property {string} id The id of the missing image.
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * // Set an event listener that fires
     * // an icon or pattern is missing.
     * map.on('styleimagemissing', function() {
     *   console.log('A styleimagemissing event occurred.');
     * });
     * @see [Generate and add a missing icon to the map](https://mapbox.com/mapbox-gl-js/example/add-image-missing-generated/)
     */
    | 'styleimagemissing'

    /**
     * @event style.load
     * @memberof Map
     * @instance
     * @private
     */
    | 'style.load'

    /**
     * Fired after speed index calculation is completed if speedIndexTiming option has set to true
     *
     * @private
     * @event speedindexcompleted
     * @memberof Map
     * @instance
     * @example
     * // Initialize the map
     * var map = new mapboxgl.Map({ // map options });
     * map.speedIndexTiming = true;
     * // Set an event listener that fires
     * map.on('speedindexcompleted', function() {
     *   console.log(`speed index is ${map.speedIndexNumber}`);
     * });
     */
    | 'speedindexcompleted'
;
