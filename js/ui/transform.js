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

    get minScale() { return this.zoomScale(this.minZoom - 1); },
    get maxScale() { return this.zoomScale(this.maxZoom - 1); },

    get worldSize() { return this.tileSize * this.scale; },
    get center() { return [this.lon, this.lat]; },
    get centerPoint() { return {x: this._hW, y: this._hH}; },

    get z() { return this.scaleZoom(this.scale); },
    get zoom() { return Math.floor(this.z); },
    set zoom(zoom) {
        this.scale = this.zoomScale(zoom);
    },
    get zoomFraction() { return this.z - this.zoom; },

    zoomScale: function(zoom) { return Math.pow(2, zoom); },
    scaleZoom: function(scale) { return Math.log(scale) / Math.LN2; },

    get left() { return this.x - this._hW; },
    get top() { return this.y - this._hH; },

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

    rotated: function(x, y) {
        var sin = Math.sin(-this.angle),
            cos = Math.cos(-this.angle);
        return {
            x: sin * y - cos * x,
            y: sin * x + cos * y
        };
    },

    panBy: function(x, y) {
        var l = this.pointLocation({
            x: this.centerPoint.x + x,
            y: this.centerPoint.y + y
        });
        this.lon = l.lon;
        this.lat = l.lat;
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
            pt1.x - pt2.x,
            pt1.y - pt2.y
        );
    },

    locationPoint: function(l) {
        var dx = this.lonX(l.lon) - this.lonX(this.lon),
            dy = this.latY(this.lat) - this.latY(l.lat),
            p = this.rotated(dx, dy);
        return {
            x: this.centerPoint.x - p.x,
            y: this.centerPoint.y - p.y
        };
    },

    pointLocation: function(p) {
        var dp = this.rotated(
            this.centerPoint.x - p.x,
            this.centerPoint.y - p.y);
        return {
            lon: this.xLon(this.lonX(this.lon) + dp.x),
            lat: this.yLat(this.latY(this.lat) - dp.y)
        };
    },

    locationCoordinate: function(l) {
        return {
            column: this.lonX(l.lon) / this.tileSize,
            row: this.latY(l.lat) / this.tileSize,
            zoom: this.zoom
        };
    },

    pointCoordinate: function(tileCenter, p) {
        var zoomFactor = this.zoomScale(this.zoomFraction),
            kt = this.zoomScale(this.zoom - tileCenter.zoom),
            k = 1 / (this.tileSize * zoomFactor),
            dp = this.rotated(
                this.centerPoint.x - p.x,
                this.centerPoint.y - p.y);

        return {
            column: tileCenter.column * kt - dp.x * k,
            row: tileCenter.row * kt - dp.y * k,
            zoom: this.zoom
        };
    },

    get centerOrigin() { return [this._hW, this._hH, 0]; },
    get icenterOrigin() { return [-this._hW, -this._hH, 0]; }
};
