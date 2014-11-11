'use strict';

var Tile = require('./tile');
var ajax = require('../util/ajax');
var util = require('../util/util');

module.exports = RasterTile;

function RasterTile(id, source, url, callback) {
    this.id = id;
    this.loaded = false;
    this.url = url;
    this.source = source;
    this.map = source.map;
    this.callback = callback;
    this.uses = 1;

    ajax.getImage(this.url, this._loaded.bind(this));
}

RasterTile.prototype = util.inherit(Tile, {
    _loaded: function(err, img) {
        // Tile has been removed from the map
        if (!this.map) return;

        if (err) return this.callback(err);

        this.img = img;

        // start texture upload
        this.bind(this.map.painter.gl);

        this.timeAdded = new Date().getTime();
        this.map.animationLoop.set(this.map.style.rasterFadeDuration);

        this.buckets = {};
        var buckets = this.map.style.buckets;
        for (var b in buckets) {
            var bucket = buckets[b];
            var sourceid = bucket && bucket.source;
            if (this.source.id === sourceid) {
                this.buckets[b] = {
                    layoutProperties: bucket.layout,
                    type: 'raster',
                    tile: this
                };
            }
        }

        this.loaded = true;
        this.callback(null, this);
    },

    abort: function() {
        this.aborted = true;
        if (this.img) this.img.src = '';
        delete this.img;
    },

    bind: function(gl) {
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
    },

    remove: function() {
        if (this.texture) this.map.painter.saveTexture(this.texture);
        delete this.map;
    },

    featuresAt: function(pos, params, callback) {
        // noop
        callback(null, []);
    }
});