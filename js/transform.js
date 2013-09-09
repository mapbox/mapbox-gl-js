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
        return -((this.lon + 180) * k) * this.scale;
    },

    get y() {
        var k = 1 / 360;
        return -((180 - lat2y(this.lat)) * k) * this.scale;
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

    get angleSini() {
        return Math.sin(-this.angle);
    },

    get angleCosi() {
        return Math.cos(-this.angle);
    },

    pointCoordinate: function(tileCenter, p) {
        var sizeRadius = {
            x: this._hW,
            y: this._hH,
        };

        var zoom = this.zoom,
            zoomFraction = zoom - (zoom = Math.round(zoom)),
            zoomFactor = Math.pow(2, zoomFraction),
            kt = Math.pow(2, this.zoom - tileCenter.zoom),
            dx = (p.x - sizeRadius.x) / zoomFactor,
            dy = (p.y - sizeRadius.y) / zoomFactor;

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
