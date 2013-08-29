function Transform(size) {
    this._size = size; // constant

    this.width = 0;
    this.height = 0;
    this.scale = 1;

    this.x = 0;
    this.y = 0;
}

Transform.prototype = {
    get size() { return this._size; },
    get world() { return this._size * this.scale; },

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

    get ry() {
        return this._height - this.y - this.world;
    },

    get lon() {
        return -(this.x + this._zc - this._hW) / this._Bc;
    },

    set lon(lon) {
        this.x = -(+lon * this._Bc + this._zc) + this._hW;
    },

    get lat() {
        var g = Math.exp((this.y - this._hH + this._zc) / this._Cc);
        return 360 / Math.PI * Math.atan(g) - 90;
    },

    set lat(lat) {
        var f = Math.min(Math.max(Math.sin((Math.PI / 180) * lat), -0.9999), 0.9999);
        this.y = -(this._zc - 0.5 * Math.log((1 + f) / (1 - f)) * this._Cc) + this._hH;
    }
};
