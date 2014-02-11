'use strict';

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
        // Clamp to the new minzoom.
        this.zoomAround(1, this.centerPoint);
    },

    get maxZoom() { return this._maxZoom; },
    set maxZoom(zoom) {
        this._maxZoom = zoom;
        // Clamp to the new minzoom.
        this.zoomAround(1, this.centerPoint);
    },

    get minScale() { return Math.pow(2, this.minZoom - 1); },
    get maxScale() { return Math.pow(2, this.maxZoom - 1); },

    get world() { return this.tileSize * this.scale; },
    get center() { return [this.lon, this.lat]; },
    get centerPoint() { return {x: this._hW, y: this._hH}; },

    get z() { return Math.log(this.scale) / Math.LN2; },
    get zoom() { return Math.floor(this.z); },
    set zoom(zoom) { this.scale = Math.pow(2, zoom); },

    get x() {
        var k = 1 / 360;
        return (-(this.lon + 180) * k * this.world) + this._hW;
    },

    get y() {
        var k = 1 / 360;
        return (-((180 - lat2y(this.lat)) * k) * this.world) + this._hH;
    },

    setSize: function (width, height) {
        this.width = width;
        this.height = height;
        this._hW = width / 2;
        this._hH = height / 2;
    },

    panBy: function(x, y) {
        var k = 360 / this.scale,
            dx = x * k,
            dy = y * k;

        this.lon = this.lon + (this.angleSini * dy - this.angleCosi * dx) / this.tileSize;
        this.lat = y2lat(lat2y(this.lat) + (this.angleSini * dx + this.angleCosi * dy) / this.tileSize);
    },

    zoomAround: function(scale, pt) {
        this.zoomAroundTo(this.scale * scale, pt);
    },

    zoomAroundTo: function(scale, pt) {
        var pt1 = { x: this.width - pt.x, y: this.height - pt.y };
        var l = this.pointLocation(pt1);
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
        var pt2 = this.locationPoint(l);
        this.panBy(
            pt2.x - pt1.x,
            pt2.y - pt1.y
        );
    },

    locationPoint: function(l) {
        var k = this.scale / 360,
            dx = (l.lon - this.lon) * k * this.tileSize,
            dy = (lat2y(this.lat) - lat2y(l.lat)) * k * this.tileSize;
        return {
            x: this.sizeRadius.x + this.angleCos * dx - this.angleSin * dy,
            y: this.sizeRadius.y + this.angleSin * dx + this.angleCos * dy
        };
    },

    pointLocation: function(p) {
        var k = 360 / this.scale,
            dx = (p.x - this.sizeRadius.x) * k,
            dy = (p.y - this.sizeRadius.y) * k;
        return {
            lon: this.lon + (this.angleCosi * dx - this.angleSini * dy) / this.tileSize,
            lat: y2lat(lat2y(this.lat) - (this.angleSini * dx + this.angleCosi * dy) / this.tileSize)
        };
    },

    locationCoordinate: function(l) {
        var k = 1 / 360;

        var c = {
            column: (l.lon + 180) * k,
            row: (180 - lat2y(l.lat)) * k,
            zoom: 0
        };

        k = Math.pow(2, this.zoom);
        c.column *= k;
        c.row *= k;
        c.zoom += this.zoom;
        return c;
    },

    pointCoordinate: function(tileCenter, p) {
        var zoom = this.zoom,
            zoomFactor = Math.pow(2, this.zoomFraction),
            kt = Math.pow(2, zoom - tileCenter.zoom),
            dx = (p.x - this.sizeRadius.x) / zoomFactor,
            dy = (p.y - this.sizeRadius.y) / zoomFactor;

        return {
            column: (tileCenter.column * kt) +
                (this.angleCosi * dx - this.angleSini * dy) / this.tileSize,
            row: (tileCenter.row * kt) +
                (this.angleSini * dx + this.angleCosi * dy) / this.tileSize,
            zoom: zoom
        };
    },

    get angleCos() { return Math.cos(this.angle); },
    get angleSin() { return Math.sin(this.angle); },

    get angleSini() { return Math.sin(-this.angle); },
    get angleCosi() { return Math.cos(-this.angle); },

    get centerOrigin() { return [this._hW, this._hH, 0]; },
    get icenterOrigin() { return [-this._hW, -this._hH, 0]; },

    get sizeRadius() {
        return {
            x: this._hW,
            y: this._hH,
        };
    },

    get zoomFraction() {
        return this.z - this.zoom;
    },
};

function y2lat(y) {
  return 360 / Math.PI * Math.atan(Math.exp(y * Math.PI / 180)) - 90;
}

function lat2y(lat) {
  return 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}
