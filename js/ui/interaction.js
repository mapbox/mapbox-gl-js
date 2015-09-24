'use strict';

var handlers = {
    scrollZoom: require('./handler/scroll_zoom'),
    boxZoom: require('./handler/box_zoom'),
    dragRotate: require('./handler/drag_rotate'),
    dragPan: require('./handler/drag_pan'),
    keyboard: require('./handler/keyboard'),
    doubleClickZoom: require('./handler/dblclick_zoom'),
    pinch: require('./handler/pinch')
};

var DOM = require('../util/dom'),
    util = require('../util/util');

module.exports = Interaction;

/**
 * Mouse move event.
 *
 * @event mousemove
 * @memberof Map
 * @type {Object}
 * @property {Point} point the pixel location of the event
 * @property {LngLat} lngLat the geographic location of the event
 * @property {Event} originalEvent the original DOM event
 */

/**
 * Click event.
 *
 * @event click
 * @memberof Map
 * @type {Object}
 * @property {Point} point the pixel location of the event
 * @property {LngLat} lngLat the geographic location of the event
 * @property {Event} originalEvent the original DOM event
 */

/**
 * Double click event.
 *
 * @event dblclick
 * @memberof Map
 * @type {Object}
 * @property {Point} point the pixel location of the event
 * @property {LngLat} lngLat the geographic location of the event
 * @property {Event} originalEvent the original DOM event
 */

/**
 * Context menu event.
 *
 * @event contextmenu
 * @memberof Map
 * @type {Object}
 * @property {Point} point the pixel location of the event
 * @property {LngLat} lngLat the geographic location of the event
 * @property {Event} originalEvent the original DOM event
 */

/**
 * Load event. This event is emitted immediately after all necessary resources have been downloaded
 * and the first visually complete rendering has occurred.
 *
 * @event load
 * @memberof Map
 * @type {Object}
 */

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
        el.addEventListener('touchstart', this._onTouchStart, false);
        el.addEventListener('click', this._onClick, false);
        el.addEventListener('mousemove', this._onMouseMove, false);
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
        el.removeEventListener('touchstart', this._onTouchStart);
        el.removeEventListener('click', this._onClick);
        el.removeEventListener('mousemove', this._onMouseMove);
        el.removeEventListener('dblclick', this._onDblClick);
        el.removeEventListener('contextmenu', this._onContextMenu);
    },

    _onMouseDown: function (e) {
        this._startPos = DOM.mousePos(this._el, e);
    },

    _onMouseUp: function (e) {
        if (this._contextMenuFired && DOM.mousePos(this._el, e).equals(this._startPos))
            this._fireEvent('contextmenu', e);

        this._contextMenuFired = null;
    },

    _onTouchStart: function (e) {
        if (!e.touches || e.touches.length > 1) return;

        if (!this._tapped) {
            this._tapped = setTimeout(this._onTimeout, 300);

        } else {
            clearTimeout(this._tapped);
            this._tapped = null;
            this._fireEvent('dblclick', e);
        }
    },

    _onTimeout: function () {
        this._tapped = null;
    },

    _onMouseMove: function (e) {
        var map = this._map,
            el = this._el;

        if (map.dragPan.active || map.dragRotate.active) return;

        var target = e.toElement || e.target;
        while (target && target !== el) target = target.parentNode;
        if (target !== el) return;

        this._fireEvent('mousemove', e);
    },

    _onClick: function (e) {
        var pos = DOM.mousePos(this._el, e);

        if (pos.equals(this._startPos)) {
            this._fireEvent('click', e);
        }
    },

    _onDblClick: function (e) {
        this._fireEvent('dblclick', e);
        e.preventDefault();
    },

    _onContextMenu: function () {
        this._contextMenuFired = true;
    },

    _fireEvent: function (type, e) {
        var pos = DOM.mousePos(this._el, e);

        this._map.fire(type, {
            lngLat: this._map.unproject(pos),
            point: pos,
            originalEvent: e
        });
    }
};
