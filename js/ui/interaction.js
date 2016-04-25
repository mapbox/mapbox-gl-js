'use strict';

var handlers = {
    scrollZoom: require('./handler/scroll_zoom'),
    boxZoom: require('./handler/box_zoom'),
    dragRotate: require('./handler/drag_rotate'),
    dragPan: require('./handler/drag_pan'),
    keyboard: require('./handler/keyboard'),
    doubleClickZoom: require('./handler/dblclick_zoom'),
    touchZoomRotate: require('./handler/touch_zoom_rotate')
};

var DOM = require('../util/dom'),
    util = require('../util/util'),
    Point = require('point-geometry');

module.exports = Interaction;

function Interaction(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    for (var name in handlers) {
        map[name] = new handlers[name](map);
    }

    util.bindHandlers(this);
}

Interaction.prototype = {
    enable: function () {
        var options = this._map.options,
            el = this._el;

        for (var name in handlers) {
            if (options[name]) this._map[name].enable();
        }

        el.addEventListener('mousedown', this._onMouseDown, false);
        el.addEventListener('mouseup', this._onMouseUp, false);
        el.addEventListener('mousemove', this._onMouseMove, false);
        el.addEventListener('touchstart', this._onTouchStart, false);
        el.addEventListener('touchend', this._onTouchEnd, false);
        el.addEventListener('touchmove', this._onTouchMove, false);
        el.addEventListener('touchcancel', this._onTouchCancel, false);
        el.addEventListener('click', this._onClick, false);
        el.addEventListener('dblclick', this._onDblClick, false);
        el.addEventListener('contextmenu', this._onContextMenu, false);
    },

    disable: function () {
        var options = this._map.options,
            el = this._el;

        for (var name in handlers) {
            if (options[name]) this._map[name].disable();
        }

        el.removeEventListener('mousedown', this._onMouseDown);
        el.removeEventListener('mouseup', this._onMouseUp);
        el.removeEventListener('mousemove', this._onMouseMove);
        el.removeEventListener('touchstart', this._onTouchStart);
        el.removeEventListener('touchend', this._onTouchEnd);
        el.removeEventListener('touchmove', this._onTouchMove);
        el.removeEventListener('touchcancel', this._onTouchCancel);
        el.removeEventListener('click', this._onClick);
        el.removeEventListener('dblclick', this._onDblClick);
        el.removeEventListener('contextmenu', this._onContextMenu);
    },

    _onMouseDown: function (e) {
        this._map.stop();
        this._startPos = DOM.mousePos(this._el, e);
        this._fireMouseEvent('mousedown', e);
    },

    _onMouseUp: function (e) {
        var map = this._map,
            rotating = map.dragRotate && map.dragRotate.isActive();

        if (this._contextMenuEvent && !rotating) {
            this._fireMouseEvent('contextmenu', this._contextMenuEvent);
        }

        this._contextMenuEvent = null;
        this._fireMouseEvent('mouseup', e);
    },

    _onMouseMove: function (e) {
        var map = this._map,
            el = this._el;

        if (map.dragPan && map.dragPan.isActive()) return;
        if (map.dragRotate && map.dragRotate.isActive()) return;

        var target = e.toElement || e.target;
        while (target && target !== el) target = target.parentNode;
        if (target !== el) return;

        this._fireMouseEvent('mousemove', e);
    },

    _onTouchStart: function (e) {
        this._map.stop();
        this._fireTouchEvent('touchstart', e);

        if (!e.touches || e.touches.length > 1) return;

        if (!this._tapped) {
            this._tapped = setTimeout(this._onTouchTimeout, 300);

        } else {
            clearTimeout(this._tapped);
            this._tapped = null;
            this._fireMouseEvent('dblclick', e);
        }
    },

    _onTouchMove: function (e) {
        this._fireTouchEvent('touchmove', e);
    },

    _onTouchEnd: function (e) {
        this._fireTouchEvent('touchend', e);
    },

    _onTouchCancel: function (e) {
        this._fireTouchEvent('touchcancel', e);
    },

    _onTouchTimeout: function () {
        this._tapped = null;
    },

    _onClick: function (e) {
        var pos = DOM.mousePos(this._el, e);

        if (pos.equals(this._startPos)) {
            this._fireMouseEvent('click', e);
        }
    },

    _onDblClick: function (e) {
        this._fireMouseEvent('dblclick', e);
        e.preventDefault();
    },

    _onContextMenu: function (e) {
        this._contextMenuEvent = e;
        e.preventDefault();
    },

    _fireMouseEvent: function (type, e) {
        var pos = DOM.mousePos(this._el, e);

        return this._map.fire(type, {
            lngLat: this._map.unproject(pos),
            point: pos,
            originalEvent: e
        });
    },

    _fireTouchEvent: function (type, e) {
        var touches = DOM.touchPos(this._el, e),
            singular = touches.reduce(function (prev, curr, i, arr) {
                return prev.add(curr.div(arr.length));
            }, new Point(0, 0));

        return this._map.fire(type, {
            lngLat: this._map.unproject(singular),
            point: singular,
            lngLats: touches.map(function(t) { return this._map.unproject(t); }, this),
            points: touches,
            originalEvent: e
        });
    }
};


/**
 * When an event [fires]{@link #Evented.fire} as a result of a
 * user interaction, the event will be called with an EventData
 * object containing the original DOM event along with coordinates of
 * the event target.
 *
 * @typedef {Object} EventData
 * @property {Event} originalEvent The original DOM event
 * @property {Point} point The pixel location of the event
 * @property {LngLat} lngLat The geographic location of the event
 * @example
 * map.on('click', function(data) {
 *   var e = data && data.originalEvent;
 *   console.log('got click ' + (e ? 'button = ' + e.button : ''));
 * });
 */

/**
 * Mouse down event.
 *
 * @event mousedown
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [mousedown event](https://developer.mozilla.org/en-US/docs/Web/Events/mousedown)
 */

/**
 * Mouse up event.
 *
 * @event mouseup
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [mouseup event](https://developer.mozilla.org/en-US/docs/Web/Events/mouseup)
 */

/**
 * Mouse move event.
 *
 * @event mousemove
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [mousemouse event](https://developer.mozilla.org/en-US/docs/Web/Events/mousemove)
 */

/**
 * Touch start event.
 *
 * @event touchstart
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [touchstart event](https://developer.mozilla.org/en-US/docs/Web/Events/touchstart).
 */

/**
 * Touch end event.
 *
 * @event touchend
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [touchcancel event](https://developer.mozilla.org/en-US/docs/Web/Events/touchcancel).
 */

/**
 * Touch move event.
 *
 * @event touchmove
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [touchmove event](https://developer.mozilla.org/en-US/docs/Web/Events/touchmove).
 */

/**
 * Touch cancel event.
 *
 * @event touchcancel
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [touchcancel event](https://developer.mozilla.org/en-US/docs/Web/Events/touchcancel).
 */

/**
 * Click event.
 *
 * @event click
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data: a [click event](https://developer.mozilla.org/en-US/docs/Web/Events/click)
 */

/**
 * Double click event.
 *
 * @event dblclick
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data
 */

/**
 * Context menu event.
 *
 * @event contextmenu
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data, if available
 */

/**
 * Load event. This event is emitted immediately after all necessary resources have been downloaded
 * and the first visually complete rendering has occurred.
 *
 * @event load
 * @memberof Map
 * @instance
 * @type {Object}
 */

/**
 * Move start event. This event is emitted just before the map begins a transition from one
 * view to another, either as a result of user interaction or the use of methods such as `Map#jumpTo`.
 *
 * @event movestart
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data, if fired interactively
 */

/**
 * Move event. This event is emitted repeatedly during animated transitions from one view to
 * another, either as a result of user interaction or the use of methods such as `Map#jumpTo`.
 *
 * @event move
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data, if fired interactively
 */

/**
 * Move end event. This event is emitted just after the map completes a transition from one
 * view to another, either as a result of user interaction or the use of methods such as `Map#jumpTo`.
 *
 * @event moveend
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data, if fired interactively
 */
