'use strict';

var DOM = require('../../util/dom'),
    LatLngBounds = require('../../geo/lat_lng_bounds');

module.exports = BoxZoom;


function BoxZoom(map) {
    this._map = map;
    this._el = map.getCanvas();
    this._container = map.getContainer();

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
}

BoxZoom.prototype = {
    enable: function () {
        this._el.addEventListener('mousedown', this._onMouseDown, false);
    },

    disable: function () {
        this._el.removeEventListener('mousedown', this._onMouseDown, false);
    },

    _onMouseDown: function (e) {
        if (e.shiftKey || (e.which === 1 && e.button === 1)) {
            document.addEventListener('mousemove', this._onMouseMove, false);
            document.addEventListener('keydown', this._onKeyDown, false);
            document.addEventListener('mouseup', this._onMouseUp, false);

            this._startPos = DOM.mousePos(this._el, e);
        }
    },

    _onMouseMove: function (e) {
        var p0 = this._startPos,
            p1 = DOM.mousePos(this._el, e);

        if (!this._box) {
            this._box = DOM.create('div', 'mapboxgl-boxzoom', this._container);
            this._container.classList.add('mapboxgl-crosshair');

            DOM.disableDrag();

            this._map.fire('boxzoomstart');
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
        var p0 = this._startPos,
            p1 = DOM.mousePos(this._el, e),
            bounds = new LatLngBounds(this._map.unproject(p0), this._map.unproject(p1));

        this._finish();

        this._map
            .fitBounds(bounds, {linear: true})
            .fire('boxzoomend', {boxZoomBounds: bounds});
    },

    _onKeyDown: function (e) {
        if (e.keyCode === 27) {
            this._finish();
            this._map.fire('boxzoomcancel');
        }
    },

    _finish: function () {
        if (!this._box) return;

        document.removeEventListener('mousemove', this._onMouseMove, false);
        document.removeEventListener('keydown', this._onKeyDown, false);
        document.removeEventListener('mouseup', this._onMouseUp, false);

        this._container.classList.remove('mapboxgl-crosshair');

        this._box.parentNode.removeChild(this._box);
        this._box = null;

        DOM.enableDrag();
    }
};
