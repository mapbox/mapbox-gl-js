'use strict';

var DOM = require('../../util/dom');

module.exports = DoubleClickZoom;


function DoubleClickZoom(map) {
    this._map = map;
    this._el = map.getCanvas();

    this._onDblClick = this._onDblClick.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTimeout = this._onTimeout.bind(this);
}

DoubleClickZoom.prototype = {
    enable: function () {
        this._el.addEventListener('dblclick', this._onDblClick, false);
        this._el.addEventListener('touchstart', this._onTouchStart, false);
    },

    disable: function () {
        this._el.removeEventListener('dblclick', this._onDblClick);
        this._el.removeEventListener('touchstart', this._onTouchStart);
    },

    _onDblClick: function (e) {
        this._zoom(e);
        e.preventDefault();
    },

    _onTouchStart: function (e) {
        if (!e.touches || e.touches.length > 1) return;

        if (!this._tapped) {
            this._tapped = setTimeout(this._onTimeout, 300);

        } else {
            clearTimeout(this._tapped);
            this._tapped = null;
            this._zoom(e);
        }
    },

    _onTimeout: function () {
        this._tapped = null;
    },

    _zoom: function (e) {
        var pos = DOM.mousePos(this._el, e),
            map = this._map;

        map.zoomTo(Math.round(map.getZoom()) + 1, {around: map.unproject(pos)});
    }
};
