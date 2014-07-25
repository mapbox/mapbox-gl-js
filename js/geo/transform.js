'use strict';

var LatLng = require('./latlng.js'),
    Point = require('point-geometry');

module.exports = Transform;

// A single transform, generally used for a single tile to be scaled, rotated, and zoomed.

function Transform(tileSize, minZoom, maxZoom) {
    this.tileSize = tileSize; // constant

    this._minZoom = minZoom || 0;
    this._maxZoom = maxZoom || 22;

    this.width = 0;
    this.height = 0;
    this.zoom = 0;
    this.center = new LatLng(0, 0);
    this.angle = 0;
}

Transform.prototype = {

    // lon = ((((lon + 180) % 360) + 360) % 360) - 180;

    get minZoom() { return this._minZoom; },
    set minZoom(zoom) {
        this._minZoom = zoom;
        this.zoom = Math.max(this.zoom, zoom);
    },

    get maxZoom() { return this._maxZoom; },
    set maxZoom(zoom) {
        this._maxZoom = zoom;
        this.zoom = Math.min(this.zoom, zoom);
    },

    get worldSize() {
        return this.tileSize * this.scale;
    },

    get centerPoint() {
        return this.size._div(2);
    },

    get size() {
        return new Point(this.width, this.height);
    },

    get bearing() {
        return -this.angle / Math.PI * 180;
    },
    set bearing(bearing) {
        // confine the angle to within [-180,180]
        bearing = ((((bearing + 180) % 360) + 360) % 360) - 180;
        this.angle = -bearing * Math.PI / 180;
    },

    get zoom() { return this._zoom; },
    set zoom(zoom) {
        zoom = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
        this._zoom = zoom;
        this.scale = this.zoomScale(zoom);
        this.tileZoom = Math.floor(zoom);
        this.zoomFraction = zoom - this.tileZoom;
    },

    zoomScale: function(zoom) { return Math.pow(2, zoom); },
    scaleZoom: function(scale) { return Math.log(scale) / Math.LN2; },

    project: function(latlng, worldSize) {
        return new Point(
            this.lngX(latlng.lng, worldSize),
            this.latY(latlng.lat, worldSize));
    },

    unproject: function(point, worldSize) {
        return new LatLng(
            this.yLat(point.y, worldSize),
            this.xLng(point.x, worldSize));
    },

    get x() { return this.lngX(this.center.lng); },
    get y() { return this.latY(this.center.lat); },

    get point() { return new Point(this.x, this.y); },

    // lat/lon <-> absolute pixel coords convertion
    lngX: function(lon, worldSize) {
        return (180 + lon) * (worldSize || this.worldSize) / 360;
    },
    // latitude to absolute y coord
    latY: function(lat, worldSize) {
        var y = 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        return (180 - y) * (worldSize || this.worldSize) / 360;
    },

    xLng: function(x, worldSize) {
        return x * 360 / (worldSize || this.worldSize) - 180;
    },
    yLat: function(y, worldSize) {
        var y2 = 180 - y * 360 / (worldSize || this.worldSize);
        return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
    },

    panBy: function(offset) {
        var point = this.centerPoint._add(offset);
        this.center = this.pointLocation(point);
    },

    zoomAroundTo: function(zoom, p) {
        var p1 = this.size._sub(p),
            latlng = this.pointLocation(p1);
        this.zoom = zoom;
        this.panBy(p1.sub(this.locationPoint(latlng)));
    },

    locationPoint: function(latlng) {
        var p = this.project(latlng);
        return this.centerPoint._sub(this.point._sub(p)._rotate(this.angle));
    },

    pointLocation: function(p) {
        var p2 = this.centerPoint._sub(p)._rotate(-this.angle);
        return this.unproject(this.point.sub(p2));
    },

    locationCoordinate: function(latlng) {
        var k = this.zoomScale(this.tileZoom) / this.worldSize;
        return {
            column: this.lngX(latlng.lng) * k,
            row: this.latY(latlng.lat) * k,
            zoom: this.tileZoom
        };
    },

    pointCoordinate: function(tileCenter, p) {
        var zoomFactor = this.zoomScale(this.zoomFraction),
            kt = this.zoomScale(this.tileZoom - tileCenter.zoom),
            p2 = this.centerPoint._sub(p)._rotate(-this.angle)._div(this.tileSize * zoomFactor);

        return {
            column: tileCenter.column * kt - p2.x,
            row: tileCenter.row * kt - p2.y,
            zoom: this.tileZoom
        };
    }
};
