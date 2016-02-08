'use strict';

var DOM = require('../../util/dom'),
    LngLatBounds = require('../../geo/lng_lat_bounds'),
    util = require('../../util/util');

module.exports = BoxZoom;


function BoxZoom(map) {
    this._map = map;
    this._el = map.getCanvasContainer();
    this._container = map.getContainer();

    util.bindHandlers(this);
}

BoxZoom.prototype = {
    enable: function () {
        this.disable();
        this._el.addEventListener('mousedown', this._onMouseDown, false);
    },

    disable: function () {
        this._el.removeEventListener('mousedown', this._onMouseDown);
    },

    _onMouseDown: function (e) {
        if (!(e.shiftKey && e.button === 0)) return;

        document.addEventListener('mousemove', this._onMouseMove, false);
        document.addEventListener('keydown', this._onKeyDown, false);
        document.addEventListener('mouseup', this._onMouseUp, false);

        DOM.disableDrag();
        this._startPos = DOM.mousePos(this._el, e);
        this.active = true;
    },

    _onMouseMove: function (e) {
        var p0 = this._startPos,
            p1 = DOM.mousePos(this._el, e);

        if (!this._box) {
            this._box = DOM.create('div', 'mapboxgl-boxzoom', this._container);
            this._container.classList.add('mapboxgl-crosshair');
            this._fireEvent('boxzoomstart', e);
        }

        var minX = Math.min(p0.x, p1.x),
            maxX = Math.max(p0.x, p1.x),
            minY = Math.min(p0.y, p1.y),
            maxY = Math.max(p0.y, p1.y);

        DOM.setTransform(this._box, 'translate(' + minX + 'px,' + minY + 'px)');

        this._box.style.width = (maxX - minX) + 'px';
        this._box.style.height = (maxY - minY) + 'px';
    },

    _onMouseUp: function (e) {
        if (e.button !== 0) return;

        var p0 = this._startPos,
            p1 = DOM.mousePos(this._el, e),
            bounds = new LngLatBounds(this._map.unproject(p0), this._map.unproject(p1));

        this._finish();

        if (p0.x === p1.x && p0.y === p1.y) {
            this._fireEvent('boxzoomcancel', e);
        } else {
            this._map
                .fitBounds(bounds, {linear: true})
                .fire('boxzoomend', { originalEvent: e, boxZoomBounds: bounds });
        }
    },

    _onKeyDown: function (e) {
        if (e.keyCode === 27) {
            this._finish();
            this._fireEvent('boxzoomcancel', e);
        }
    },

    _finish: function () {
        this.active = false;

        document.removeEventListener('mousemove', this._onMouseMove, false);
        document.removeEventListener('keydown', this._onKeyDown, false);
        document.removeEventListener('mouseup', this._onMouseUp, false);

        this._container.classList.remove('mapboxgl-crosshair');

        if (this._box) {
            this._box.parentNode.removeChild(this._box);
            this._box = null;
        }

        DOM.enableDrag();
    },

    _fireEvent: function (type, e) {
        return this._map.fire(type, { originalEvent: e });
    }
};


/**
 * Boxzoom start event. This event is emitted at the start of a box zoom interaction.
 *
 * @event boxzoomstart
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data
 */

/**
 * Boxzoom end event. This event is emitted at the end of a box zoom interaction
 *
 * @event boxzoomend
 * @memberof Map
 * @instance
 * @type {Object}
 * @property {Event} originalEvent the original DOM event
 * @property {LngLatBounds} boxZoomBounds the bounds of the box zoom target
 */

/**
 * Boxzoom cancel event.  This event is emitted when the user cancels a box zoom interaction,
 *   or when the box zoom does not meet the minimum size threshold.
 *
 * @event boxzoomcancel
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data
 */
