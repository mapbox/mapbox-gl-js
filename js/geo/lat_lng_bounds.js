'use strict';

module.exports = LatLngBounds;

var LatLng = require('./lat_lng');

function LatLngBounds(sw, ne) {
    if (!sw) return;

    var latlngs = ne ? [sw, ne] : sw;

    for (var i = 0, len = latlngs.length; i < len; i++) {
        this.extend(latlngs[i]);
    }
}

LatLngBounds.prototype = {

    // extend the bounds to contain the given point or bounds
    extend: function (obj) {
        var sw = this._sw,
            ne = this._ne,
            sw2, ne2;

        if (obj instanceof LatLng) {
            sw2 = obj;
            ne2 = obj;

        } else if (obj instanceof LatLngBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;

            if (!sw2 || !ne2) return this;

        } else {
            return obj ? this.extend(LatLng.convert(obj) || LatLngBounds.convert(obj)) : this;
        }

        if (!sw && !ne) {
            this._sw = new LatLng(sw2.lat, sw2.lng);
            this._ne = new LatLng(ne2.lat, ne2.lng);

        } else {
            sw.lat = Math.min(sw2.lat, sw.lat);
            sw.lng = Math.min(sw2.lng, sw.lng);
            ne.lat = Math.max(ne2.lat, ne.lat);
            ne.lng = Math.max(ne2.lng, ne.lng);
        }

        return this;
    },

    getCenter: function () {
        return new LatLng((this._sw.lat + this._ne.lat) / 2, (this._sw.lng + this._ne.lng) / 2);
    },

    getSouthWest: function () { return this._sw; },
    getNorthEast: function () { return this._ne; },
    getNorthWest: function () { return new LatLng(this.getNorth(), this.getWest()); },
    getSouthEast: function () { return new LatLng(this.getSouth(), this.getEast()); },

    getWest:  function () { return this._sw.lng; },
    getSouth: function () { return this._sw.lat; },
    getEast:  function () { return this._ne.lng; },
    getNorth: function () { return this._ne.lat; }
};

// constructs LatLngBounds from an array if necessary
LatLngBounds.convert = function (a) {
    if (!a || a instanceof LatLngBounds) return a;
    return new LatLngBounds(a);
};
