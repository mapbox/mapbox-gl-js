'use strict';

var DOM = require('../util/dom');
var Point = require('point-geometry');

var handlers = {
    scrollZoom: require('./handler/scroll_zoom'),
    boxZoom: require('./handler/box_zoom'),
    dragRotate: require('./handler/drag_rotate'),
    dragPan: require('./handler/drag_pan'),
    keyboard: require('./handler/keyboard'),
    doubleClickZoom: require('./handler/dblclick_zoom'),
    touchZoomRotate: require('./handler/touch_zoom_rotate')
};

module.exports = function bindHandlers(map, options) {
    var el = map.getCanvasContainer();
    var contextMenuEvent = null;
    var startPos = null;
    var tapped = null;

    for (var name in handlers) {
        map[name] = new handlers[name](map, options);
        if (options.interactive && options[name]) {
            map[name].enable();
        }
    }

    el.addEventListener('mouseout', onMouseOut, false);
    el.addEventListener('mousedown', onMouseDown, false);
    el.addEventListener('mouseup', onMouseUp, false);
    el.addEventListener('mousemove', onMouseMove, false);
    el.addEventListener('touchstart', onTouchStart, false);
    el.addEventListener('touchend', onTouchEnd, false);
    el.addEventListener('touchmove', onTouchMove, false);
    el.addEventListener('touchcancel', onTouchCancel, false);
    el.addEventListener('click', onClick, false);
    el.addEventListener('dblclick', onDblClick, false);
    el.addEventListener('contextmenu', onContextMenu, false);

    function onMouseOut(e) {
        fireMouseEvent('mouseout', e);
    }

    function onMouseDown(e) {
        map.stop();
        startPos = DOM.mousePos(el, e);
        fireMouseEvent('mousedown', e);
    }

    function onMouseUp(e) {
        var rotating = map.dragRotate && map.dragRotate.isActive();

        if (contextMenuEvent && !rotating) {
            fireMouseEvent('contextmenu', contextMenuEvent);
        }

        contextMenuEvent = null;
        fireMouseEvent('mouseup', e);
    }

    function onMouseMove(e) {
        if (map.dragPan && map.dragPan.isActive()) return;
        if (map.dragRotate && map.dragRotate.isActive()) return;

        var target = e.toElement || e.target;
        while (target && target !== el) target = target.parentNode;
        if (target !== el) return;

        fireMouseEvent('mousemove', e);
    }

    function onTouchStart(e) {
        map.stop();
        fireTouchEvent('touchstart', e);

        if (!e.touches || e.touches.length > 1) return;

        if (!tapped) {
            tapped = setTimeout(onTouchTimeout, 300);

        } else {
            clearTimeout(tapped);
            tapped = null;
            fireMouseEvent('dblclick', e);
        }
    }

    function onTouchMove(e) {
        fireTouchEvent('touchmove', e);
    }

    function onTouchEnd(e) {
        fireTouchEvent('touchend', e);
    }

    function onTouchCancel(e) {
        fireTouchEvent('touchcancel', e);
    }

    function onTouchTimeout() {
        tapped = null;
    }

    function onClick(e) {
        var pos = DOM.mousePos(el, e);

        if (pos.equals(startPos)) {
            fireMouseEvent('click', e);
        }
    }

    function onDblClick(e) {
        fireMouseEvent('dblclick', e);
        e.preventDefault();
    }

    function onContextMenu(e) {
        contextMenuEvent = e;
        e.preventDefault();
    }

    function fireMouseEvent(type, e) {
        var pos = DOM.mousePos(el, e);

        return map.fire(type, {
            lngLat: map.unproject(pos),
            point: pos,
            originalEvent: e
        });
    }

    function fireTouchEvent(type, e) {
        var touches = DOM.touchPos(el, e);
        var singular = touches.reduce(function(prev, curr, i, arr) {
            return prev.add(curr.div(arr.length));
        }, new Point(0, 0));

        return map.fire(type, {
            lngLat: map.unproject(singular),
            point: singular,
            lngLats: touches.map(function(t) { return map.unproject(t); }, this),
            points: touches,
            originalEvent: e
        });
    }
};

/**
 * @typedef {Object} MapMouseEvent
 * @property {string} type The event type.
 * @property {Map} target The `Map` object that fired the event.
 * @property {MouseEvent} originalEvent
 * @property {Point} point The pixel coordinates of the mouse event target, relative to the map
 *   and measured from the top left corner.
 * @property {LngLat} lngLat The geographic location on the map of the mouse event target.
 */

/**
 * @typedef {Object} MapTouchEvent
 * @property {string} type The event type.
 * @property {Map} target The `Map` object that fired the event.
 * @property {TouchEvent} originalEvent
 * @property {Point} point The pixel coordinates of the center of the touch event points, relative to the map
 *   and measured from the top left corner.
 * @property {LngLat} lngLat The geographic location on the map of the center of the touch event points.
 * @property {Array<Point>} points The array of pixel coordinates corresponding to
 *   a [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches)
 *   property.
 * @property {Array<LngLat>} lngLats The geographical locations on the map corresponding to
 *   a [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches)
 *   property.
 */
