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

    this.lon = 0;
    this.lat = 0;
    this.angle = 0;
}

Transform.prototype = {
    get size() { return this._size; },
    get world() { return this._size * this.scale; },

    get center() {
        return [this.lon, this.lat];
    },

    get scale() { return this._scale; },
    set scale(scale) {
        this._scale = +scale;
        this._zc = this._size * scale / 2;
        this._Cc = this._size * scale / (2 * Math.PI);
        this._Bc = this._size * scale / 360;
    },

    get z() { return Math.log(this._scale) / Math.log(2); },
    get zoom() { return Math.floor(Math.log(this._scale) / Math.log(2)); },
    set zoom(zoom) { this.scale = Math.pow(2, zoom); },

    get width() { return this._width; },
    set width(width) {
        this._width = +width;
        this._hW = +width / 2;
    },

    get height() { return this._height; },
    set height(height) {
        this._height = +height;
        this._hH = +height / 2;
    },

    get x() {
        var k = 1 / 360;
        return -((this.lon + 180) * k) * this.size * this.scale;
    },

    get y() {
        var k = 1 / 360;
        return -((180 - lat2y(this.lat)) * k) * this.size * this.scale;
    },

    panBy: function(x, y) {
        var k = 45 / Math.pow(2, this.zoom + this.zoomFraction - 3),
            dx = x * k,
            dy = y * k;

        this.lon = this.lon + (this.angleSini * dy - this.angleCosi * dx) / this.size;
        this.lat = y2lat(lat2y(this.lat) + (this.angleSini * dx + this.angleCosi * dy) / this.size);
    },

    zoomAround: function(scale, pt) {
        pt.x = this._hW - pt.x;
        pt.y = this._hH - pt.y;
        var l = this.pointLocation(pt);
        this.scale *= scale;
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
        // TODO: these are magic numbers
        c.column *= k / 2;
        c.row *= k / 2;
        c.zoom += this.zoom;
        return c;
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

    get sizeRadius() {
        return {
            x: this._hW,
            y: this._hH,
        };
    },

    get zoomFraction() {
        return this.z - this.zoom;
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
    }
};

function y2lat(y) {
  return 360 / Math.PI * Math.atan(Math.exp(y * Math.PI / 180)) - 90;
}

function lat2y(lat) {
  return 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}
