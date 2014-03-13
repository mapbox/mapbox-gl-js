'use strict';

var util = require('../util/util.js');

module.exports = Transform;

/*
 * A single transform, generally used for a single tile to be scaled, rotated, and
 * zoomed.
 *
 * @param {number} tileSize
 */
function Transform(tileSize) {
    this.tileSize = tileSize; // constant

    this.setSize(0, 0);
    this.scale = 1;

    this._lon = 0;
    this.lat = 0;
    this.angle = 0;

    this._minZoom = 0;
    this._maxZoom = 22;
}

Transform.prototype = {

    get lon() { return this._lon; },
    set lon(lon) {
        this._lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    },

    get minZoom() { return this._minZoom; },
    set minZoom(zoom) {
        this._minZoom = zoom;
        this.minScale = this.zoomScale(zoom - 1);
        this.zoom = Math.max(this.zoom, zoom);
    },

    get maxZoom() { return this._maxZoom; },
    set maxZoom(zoom) {
        this._maxZoom = zoom;
        this.maxScale = this.zoomScale(this.maxZoom - 1);
        this.zoom = Math.min(this.zoom, zoom);
    },

    get worldSize() { return this.tileSize * this.scale; },
    get centerPoint() { return {x: this._hW, y: this._hH}; },

    get zoom() { return this._zoom; },
    set zoom(zoom) {
        this._zoom = zoom;
        this.scale = this.zoomScale(zoom);
        this.tileZoom = Math.floor(zoom);
        this.zoomFraction = zoom - this.tileZoom;
    },

    zoomScale: function(zoom) { return Math.pow(2, zoom); },
    scaleZoom: function(scale) { return Math.log(scale) / Math.LN2; },

    get x() { return this.lonX(this.lon); },
    get y() { return this.latY(this.lat); },

    // lat/lon <-> absolute pixel coords convertion
    lonX: function(lon) {
        return (180 + lon) * this.worldSize / 360;
    },
    // latitude to absolute y coord
    latY: function(lat) {
        var y = 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        return (180 - y) * this.worldSize / 360;
    },
    xLon: function(x, worldSize) {
        return x * 360 / (worldSize || this.worldSize) - 180;
    },
    yLat: function(y, worldSize) {
        var y2 = 180 - y * 360 / (worldSize || this.worldSize);
        return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
    },

    setSize: function(width, height) {
        this.width = width;
        this.height = height;
        this._hW = width / 2;
        this._hH = height / 2;
    },

    panBy: function(x, y) {
        var l = this.pointLocation({
            x: this._hW + x,
            y: this._hH + y
        });
        this.lon = l.lon;
        this.lat = l.lat;
    },

    zoomAroundTo: function(zoom, pt) {
        var pt1 = { x: this.width - pt.x, y: this.height - pt.y };
        var l = this.pointLocation(pt1);
        this.zoom = zoom;
        var pt2 = this.locationPoint(l);
        this.panBy(
            pt1.x - pt2.x,
            pt1.y - pt2.y
        );
    },

    locationPoint: function(l) {
        var p = util.rotate(this.angle, {
            x: this.x - this.lonX(l.lon),
            y: this.y - this.latY(l.lat)
        });
        return {
            x: this._hW - p.x,
            y: this._hH - p.y
        };
    },

    pointLocation: function(p) {
        var dp = util.rotate(-this.angle, {
            x: this._hW - p.x,
            y: this._hH - p.y
        });
        return {
            lon: this.xLon(this.x - dp.x),
            lat: this.yLat(this.y - dp.y)
        };
    },

    locationCoordinate: function(l) {
        var k = this.zoomScale(this.tileZoom) / this.worldSize;
        return {
            column: this.lonX(l.lon) * k,
            row: this.latY(l.lat) * k,
            zoom: this.tileZoom
        };
    },

    pointCoordinate: function(tileCenter, p) {
        var zoomFactor = this.zoomScale(this.zoomFraction),
            kt = this.zoomScale(this.tileZoom - tileCenter.zoom),
            k = 1 / (this.tileSize * zoomFactor);

        var dp = util.rotate(-this.angle, {
            x: this._hW - p.x,
            y: this._hH - p.y
        });

        return {
            column: tileCenter.column * kt - dp.x * k,
            row: tileCenter.row * kt - dp.y * k,
            zoom: this.tileZoom
        };
    }
};
