'use strict';

module.exports = LatLng;

var wrapNum = require('../util/util').wrapNum;

function LatLng(lat, lng) {
    if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
    }
    this.lat = +lat;
    this.lng = +lng;
}

LatLng.prototype.wrap = function () {
    return new LatLng(this.lat, wrapNum(this.lng, -180, 180));
};

// constructs LatLng from an array if necessary

LatLng.convert = function (a) {
    if (a instanceof LatLng) {
        return a;
    }
    if (Array.isArray(a)) {
        return new LatLng(a[0], a[1]);
    }
    return a;
};
