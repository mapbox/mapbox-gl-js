'use strict';

var Tile = require('./tile.js');

module.exports = RasterTile;
function RasterTile(map, url, callback) {
    this.loaded = false;
    this.url = url;
    this.map = map;
    this._load();
    this.callback = callback;
    this.uses = 1;
}

RasterTile.prototype._load = function() {
    this.img = new Image();
    this.img.crossOrigin = 'Anonymous';
    this.img.src = this.url;
    this.img.onload = this.onTileLoad.bind(this);
};

RasterTile.prototype.onTileLoad = function() {
    this.loaded = true;
    this.callback();
};

RasterTile.prototype.abort = function() {
    this.aborted = true;
    this.img.src = '';
    delete this.img;
};

RasterTile.prototype.bind = function(gl) {
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
        gl.generateMipmap(gl.TEXTURE_2D);
    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
};

RasterTile.toID = Tile.toID;
RasterTile.fromID = Tile.fromID;
RasterTile.asString = Tile.asString;
RasterTile.zoom = Tile.zoom;
RasterTile.url = Tile.url;
RasterTile.parent = Tile.parent;
RasterTile.children = Tile.children;

RasterTile.prototype.remove = function() {
    // noop
    delete this.map;
};

