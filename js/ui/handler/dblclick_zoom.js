'use strict';

module.exports = DoubleClickZoom;

function DoubleClickZoom(map) {
    this._map = map;
    this._onDblClick = this._onDblClick.bind(this);
}

DoubleClickZoom.prototype = {
    enable: function () {
        this.disable();
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
