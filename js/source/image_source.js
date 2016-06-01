'use strict';

var util = require('../util/util');
var Tile = require('./tile');
var TileCoord = require('./tile_coord');
var LngLat = require('../geo/lng_lat');
var Point = require('point-geometry');
var Evented = require('../util/evented');
var ajax = require('../util/ajax');
var EXTENT = require('../data/bucket').EXTENT;
var RasterBoundsArray = require('../render/draw_raster').RasterBoundsArray;
var Buffer = require('../data/buffer');
var VertexArrayObject = require('../render/vertex_array_object');

module.exports = ImageSource;

/**
 * Create an Image source instance given an options object
 * @class ImageSource
 * @param {Object} options
 * @param {string} options.url A string URL of an image file
 * @param {Array} options.coordinates Four geographical [lng, lat] coordinates in clockwise order defining the corners (starting with top left) of the image. Does not have to be a rectangle.
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
    this.url = options.url;
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
            this.setCoordinates(options.coordinates);
        }
    }.bind(this));
}

ImageSource.prototype = util.inherit(Evented, /** @lends ImageSource.prototype */ {
    onAdd: function(map) {
        this.map = map;
        if (this.image) {
            this.setCoordinates(this.coordinates);
        }
    },

    /**
     * Update image coordinates and rerender map
     *
     * @param {Array} coordinates Four geographical [lng, lat] coordinates in clockwise order defining the corners (starting with top left) of the image. Does not have to be a rectangle.
     * @returns {ImageSource} this
     */
    setCoordinates: function(coordinates) {
        this.coordinates = coordinates;

        // Calculate which mercator tile is suitable for rendering the image in
        // and create a buffer with the corner coordinates. These coordinates
        // may be outside the tile, because raster tiles aren't clipped when rendering.

        var map = this.map;
        var cornerZ0Coords = coordinates.map(function(coord) {
            return map.transform.locationCoordinate(LngLat.convert(coord)).zoomTo(0);
        });

        var centerCoord = this.centerCoord = util.getCoordinatesCenter(cornerZ0Coords);
        centerCoord.column = Math.round(centerCoord.column);
        centerCoord.row = Math.round(centerCoord.row);

        var tileCoords = cornerZ0Coords.map(function(coord) {
            var zoomedCoord = coord.zoomTo(centerCoord.zoom);
            return new Point(
                Math.round((zoomedCoord.column - centerCoord.column) * EXTENT),
                Math.round((zoomedCoord.row - centerCoord.row) * EXTENT));
        });

        var maxInt16 = 32767;
        var array = new RasterBoundsArray();
        array.emplaceBack(tileCoords[0].x, tileCoords[0].y, 0, 0);
        array.emplaceBack(tileCoords[1].x, tileCoords[1].y, maxInt16, 0);
        array.emplaceBack(tileCoords[3].x, tileCoords[3].y, 0, maxInt16);
        array.emplaceBack(tileCoords[2].x, tileCoords[2].y, maxInt16, maxInt16);

        this.tile = new Tile(new TileCoord(centerCoord.zoom, centerCoord.column, centerCoord.row));
        this.tile.buckets = {};

        this.tile.boundsBuffer = new Buffer(array.serialize(), RasterBoundsArray.serialize(), Buffer.BufferType.VERTEX);
        this.tile.boundsVAO = new VertexArrayObject();

        this.fire('change');

        return this;
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

    prepare: function() {
        if (!this._loaded || !this.loaded()) return;

        var painter = this.map.painter;
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
    },

    getVisibleCoordinates: function() {
        if (this.tile) return [this.tile.coord];
        else return [];
    },

    getTile: function() {
        return this.tile;
    },

    serialize: function() {
        return {
            type: 'image',
            urls: this.url,
            coordinates: this.coordinates
        };
    }
});
