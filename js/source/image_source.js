'use strict';

var util = require('../util/util');
var Tile = require('./tile');
var LngLat = require('../geo/lng_lat');
var Point = require('point-geometry');
var Evented = require('../util/evented');
var ajax = require('../util/ajax');

module.exports = ImageSource;

/**
 * Create an Image source instance given an options object
 * @class ImageSource
 * @param {Object} [options]
 * @param {string} options.url A string URL of an image file
 * @param {Array} options.coordinates lng, lat coordinates in order clockwise
 * starting at the top left: tl, tr, br, bl
 * @example
 * var sourceObj = new mapboxgl.ImageSource({
 *    url: 'https://www.mapbox.com/images/foo.png',
 *    coordinates: [
 *        [-76.54335737228394, 39.18579907229748],
 *        [-76.52803659439087, 39.1838364847587],
 *        [-76.5295386314392, 39.17683392507606],
 *        [-76.54520273208618, 39.17876344106642]
 *    ]
 * });
 * map.addSource('some id', sourceObj); // add
 * map.removeSource('some id');  // remove
 */
function ImageSource(options) {
    this.coordinates = options.coordinates;

    ajax.getImage(options.url, function(err, image) {
        // @TODO handle errors via event.
        if (err) return;

        this.image = image;

        this.image.addEventListener('load', function() {
            this.map._rerender();
        }.bind(this));

        this._loaded = true;

        if (this.map) {
            this.createTile();
            this.fire('change');
        }
    }.bind(this));
}

ImageSource.prototype = util.inherit(Evented, {
    onAdd: function(map) {
        this.map = map;
        if (this.image) {
            this.createTile();
        }
    },

    /**
     * Calculate which mercator tile is suitable for rendering the image in
     * and create a buffer with the corner coordinates. These coordinates
     * may be outside the tile, because raster tiles aren't clipped when rendering.
     * @private
     */
    createTile: function() {
        var map = this.map;
        var coords = this.coordinates.map(function(lnglat) {
            var loc = LngLat.convert(lnglat);
            return map.transform.locationCoordinate(loc).zoomTo(0);
        });

        var center = util.getCoordinatesCenter(coords);
        var tileExtent = 4096;
        var tileCoords = coords.map(function(coord) {
            var zoomedCoord = coord.zoomTo(center.zoom);
            return new Point(
                Math.round((zoomedCoord.column - center.column) * tileExtent),
                Math.round((zoomedCoord.row - center.row) * tileExtent));
        });

        var gl = map.painter.gl;
        var maxInt16 = 32767;
        var array = new Int16Array([
            tileCoords[0].x, tileCoords[0].y, 0, 0,
            tileCoords[1].x, tileCoords[1].y, maxInt16, 0,
            tileCoords[3].x, tileCoords[3].y, 0, maxInt16,
            tileCoords[2].x, tileCoords[2].y, maxInt16, maxInt16
        ]);

        this.tile = new Tile();
        this.tile.builders = {};

        this.tile.boundsBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tile.boundsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);

        this.center = center;
    },

    loaded: function() {
        return this.image && this.image.complete;
    },

    update: function() {
        // noop
    },

    reload: function() {
        // noop
    },

    render: function(layers, painter) {
        if (!this._loaded || !this.loaded()) return;

        var c = this.center;
        this.tile.calculateMatrices(c.zoom, c.column, c.row, this.map.transform, painter);

        var gl = painter.gl;

        if (!this.tile.texture) {
            this.tile.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
        }

        painter.drawLayers(layers, this.tile.posMatrix, this.tile);
    },

    /**
     * An ImageSource doesn't have any vector features that could
     * be selectable, so always return an empty array.
     * @private
     */
    featuresAt: function(point, params, callback) {
        return callback(null, []);
    }
});
