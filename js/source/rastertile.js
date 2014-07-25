'use strict';

var Tile = require('./tile.js');
var ajax = require('../util/ajax.js');

module.exports = RasterTile;

function RasterTile(id, source, url, callback) {
    this.id = id;
    this.loaded = false;
    this.url = url;
    this.source = source;
    this.map = source.map;
    this._load();
    this.callback = callback;
    this.uses = 1;

    // Todo finish figuring out what raster buckets are
    this.buckets = {};
    this.info = { raster: true };
    var buckets = this.map.style.buckets;
    for (var b in buckets) {
        var bucket = buckets[b];
        var sourceid = bucket && bucket.source;
        if (source.id === sourceid) {
            this.buckets[b] = {
                info: bucket.render,
                type: 'raster',
                tile: this
            };
        }
    }
}

RasterTile.prototype = Object.create(Tile.prototype);

RasterTile.prototype._load = function() {
    var tile = this;
    ajax.getImage(this.url, function(err, img) {
        // @TODO handle errors.
        if (err) return;
        tile.img = img;
        if (tile.map) tile.onTileLoad();
    });
};

RasterTile.prototype.onTileLoad = function() {
    // start texture upload
    this.bind(this.map.painter.gl);

    this.loaded = true;
    this.callback();
};

RasterTile.prototype.abort = function() {
    this.aborted = true;
    if (this.img) this.img.src = '';
    delete this.img;
};

RasterTile.prototype.bind = function(gl) {
    if (!this.texture) {
        // try to find reusable texture
        this.texture = this.map.painter.getTexture(this.img.width);
        if (this.texture) {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
        } else {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
            this.texture.size = this.img.width;
        }
        gl.generateMipmap(gl.TEXTURE_2D);
    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
};

RasterTile.prototype.remove = function() {
    if (this.texture) this.map.painter.saveTexture(this.texture);
    delete this.map;
};

RasterTile.prototype.featuresAt = function(pos, params, callback) {
    // noop
    callback(null, []);
};
