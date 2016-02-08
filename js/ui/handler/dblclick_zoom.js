'use strict';

module.exports = DoubleClickZoomHandler;

function DoubleClickZoomHandler(map) {
    this._map = map;
    this._onDblClick = this._onDblClick.bind(this);
}

DoubleClickZoomHandler.prototype = {
    enable: function () {
        this._map.on('dblclick', this._onDblClick);
    },

    disable: function () {
        this._map.off('dblclick', this._onDblClick);
    },

    _onDblClick: function (e) {
        this._map.zoomTo(this._map.getZoom() +
            (e.originalEvent.shiftKey ? -1 : 1), {around: e.lngLat});
    }
};
