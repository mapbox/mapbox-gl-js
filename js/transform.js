/*
 * A single transform, generally used for a single tile to be scaled, rotated, and
 * zoomed.
 *
 * @param {number} tileSize
 */
function Transform(tileSize) {
    this._size = tileSize; // constant

    this._width = null;
    this._height = null;
    this.scale = 1;

    this._lon = 0;
    this.lat = 0;
    this.angle = 0;

    this._minZoom = 0;
    this._maxZoom = 22;
}

Transform.prototype = {

    get lon() { return this._lon; },
    set lon(lon) { this._lon = ((((lon + 180) % 360) + 360) % 360) - 180; },

    get minZoom() { return this._minZoom; },
    set minZoom(zoom) {
        this._minZoom = zoom;
        // Clamp to the new minzoom.
        this.zoomAround(1, { x: this._hW, y: this._hH });
    },

    get maxZoom() { return this._maxZoom; },
    set maxZoom(zoom) {
        this._maxZoom = zoom;
        // Clamp to the new minzoom.
        this.zoomAround(1, { x: this._hW, y: this._hH });
    },

    get minScale() { return Math.pow(2, this.minZoom - 1); },
    get maxScale() { return Math.pow(2, this.maxZoom - 1); },

    get size() { return this._size; },
    get world() { return this._size * this.scale; },

    get center() {
        return [this.lon, this.lat];
    },

    get scale() { return this._scale; },
    set scale(scale) {
        this._scale = +scale;
    },

    get z() { return Math.log(this._scale) / Math.log(2); },
    get zoom() { return Math.floor(Math.log(this._scale) / Math.log(2)); },
    set zoom(zoom) { this.scale = Math.pow(2, zoom); },

    get width() { return this._width; },
    set width(width) {
        this._width = +width;
    },

    get _hW() { return this.width / 2; },
    get _hH() { return this.height / 2; },

    get height() { return this._height; },
    set height(height) {
        this._height = +height;
    },

    get x() {
        var k = 1 / 360;
        return (-((this.lon + 180) * k) * this.size * this.scale) + this._hW;
    },

    get y() {
        var k = 1 / 360;
        return (-((180 - lat2y(this.lat)) * k) * this.size * this.scale) + this._hH;
    },

    panBy: function(x, y) {
        var k = 45 / Math.pow(2, this.zoom + this.zoomFraction - 3),
            dx = x * k,
            dy = y * k;

        this.lon = this.lon + (this.angleSini * dy - this.angleCosi * dx) / this.size;
        this.lat = y2lat(lat2y(this.lat) + (this.angleSini * dx + this.angleCosi * dy) / this.size);
    },

    zoomAround: function(scale, pt) {
        pt.x = this.width - pt.x;
        pt.y = this.height - pt.y;
        var l = this.pointLocation(pt);
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * scale));
        var pt2 = this.locationPoint(l);
        this.panBy(
            pt2.x - pt.x,
            pt2.y - pt.y
        );
    },

    locationPoint: function(l) {
        var k = Math.pow(2, this.zoom + this.zoomFraction - 3) / 45,
            dx = (l.lon - this.lon) * k * this.size,
            dy = (lat2y(this.lat) - lat2y(l.lat)) * k * this.size;
        return {
            x: this.sizeRadius.x + this.angleCos * dx - this.angleSin * dy,
            y: this.sizeRadius.y + this.angleSin * dx + this.angleCos * dy
        };
    },

    pointLocation: function(p) {
        var k = 45 / Math.pow(2, this.zoom + this.zoomFraction - 3),
            dx = (p.x - this.sizeRadius.x) * k,
            dy = (p.y - this.sizeRadius.y) * k;
        return {
            lon: this.lon + (this.angleCosi * dx - this.angleSini * dy) / this.size,
            lat: y2lat(lat2y(this.lat) - (this.angleSini * dx + this.angleCosi * dy) / this.size)
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
            kt = Math.pow(2, this.zoom - tileCenter.zoom),
            dx = (p.x - this.sizeRadius.x) / zoomFactor,
            dy = (p.y - this.sizeRadius.y) / zoomFactor;

        return {
            column: (tileCenter.column * kt) +
                (this.angleCosi * dx - this.angleSini * dy) / this.size,
            row: (tileCenter.row * kt) +
                (this.angleSini * dx + this.angleCosi * dy) / this.size,
            zoom: this.zoom
        };
    },

    get angleCos() {
        return Math.cos(this.angle);
    },

    get angleSin() {
        return Math.sin(this.angle);
    },

    get angleSini() {
        return Math.sin(-this.angle);
    },

    get angleCosi() {
        return Math.cos(-this.angle);
    },

    get icenterOrigin() {
        return [-this._hW, -this._hH, 0];
    },

    get centerOrigin() {
        return [this._hW, this._hH, 0];
    },

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
