'use strict';

var util = require('../util/util');
var ajax = require('../util/ajax');
var Evented = require('../util/evented');
var loadTileJSON = require('./load_tilejson');
var normalizeURL = require('../util/mapbox').normalizeTileURL;

module.exports = RasterTileSource;

function RasterTileSource(id, options, dispatcher) {
    this.id = id;
    this.dispatcher = dispatcher;
    util.extend(this, util.pick(options, ['url', 'scheme', 'tileSize']));
    loadTileJSON(options, function (err, tileJSON) {
        if (err) {
            return this.fire('error', err);
        }
        util.extend(this, tileJSON);
        this.fire('load');
    }.bind(this));
}

RasterTileSource.prototype = util.inherit(Evented, {
    minzoom: 0,
    maxzoom: 22,
    roundZoom: true,
    scheme: 'xyz',
    tileSize: 512,
    _loaded: false,

    onAdd: function (map) {
        this.map = map;
    },

    serialize: function() {
        return {
            type: 'raster',
            url: this.url,
            tileSize: this.tileSize
        };
    },

    loadTile: function(tile, callback) {
        var url = normalizeURL(tile.coord.url(this.tiles, null, this.scheme), this.url, this.tileSize);

        tile.request = ajax.getImage(url, done.bind(this));

        function done(err, img) {
            delete tile.request;

            if (tile.aborted)
                return;

            if (err) {
                return callback(err);
            }

            var gl = this.map.painter.gl;
            tile.texture = this.map.painter.getTexture(img.width);
            if (tile.texture) {
                gl.bindTexture(gl.TEXTURE_2D, tile.texture);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
            } else {
                tile.texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tile.texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                tile.texture.size = img.width;
            }
            gl.generateMipmap(gl.TEXTURE_2D);

            this.map.animationLoop.set(this.map.style.rasterFadeDuration);

            tile.state = 'loaded';

            callback(null);
        }
    },

    abortTile: function(tile) {
        if (tile.request) {
            tile.request.abort();
            delete tile.request;
        }
    },

    unloadTile: function(tile) {
        if (tile.texture) this.map.painter.saveTexture(tile.texture);
    }
});
