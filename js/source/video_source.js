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

module.exports = VideoSource;

/**
 * Create a Video data source instance given an options object
 * @class VideoSource
 * @param {Object} options
 * @param {Array<string>} options.urls An array of URLs to video files
 * @param {Array} options.coordinates Four geographical [lng, lat] coordinates in clockwise order defining the corners (starting with top left) of the video. Does not have to be a rectangle.
 * @example
 * var sourceObj = new mapboxgl.VideoSource({
 *    url: [
 *        'https://www.mapbox.com/videos/baltimore-smoke.mp4',
 *        'https://www.mapbox.com/videos/baltimore-smoke.webm'
 *    ],
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
function VideoSource(options) {
    this.urls = options.urls;
    this.coordinates = options.coordinates;

    ajax.getVideo(options.urls, function(err, video) {
        // @TODO handle errors via event.
        if (err) return;

        this.video = video;
        this.video.loop = true;

        var loopID;

        // start repainting when video starts playing
        this.video.addEventListener('playing', function() {
            loopID = this.map.style.animationLoop.set(Infinity);
            this.map._rerender();
        }.bind(this));

        // stop repainting when video stops
        this.video.addEventListener('pause', function() {
            this.map.style.animationLoop.cancel(loopID);
        }.bind(this));

        this._loaded = true;

        if (this.map) {
            this.video.play();
            this.setCoordinates(options.coordinates);
        }
    }.bind(this));
}

VideoSource.prototype = util.inherit(Evented, /** @lends VideoSource.prototype */{
    roundZoom: true,

    /**
     * Return the HTML video element.
     *
     * @returns {Object}
     */
    getVideo: function() {
        return this.video;
    },

    onAdd: function(map) {
        this.map = map;
        if (this.video) {
            this.video.play();
            this.setCoordinates(this.coordinates);
        }
    },

    /**
     * Update video coordinates and rerender map
     *
     * @param {Array} coordinates Four geographical [lng, lat] coordinates in clockwise order defining the corners (starting with top left) of the video. Does not have to be a rectangle.
     * @returns {VideoSource} this
     */
    setCoordinates: function(coordinates) {
        this.coordinates = coordinates;

        // Calculate which mercator tile is suitable for rendering the video in
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
        return this.video && this.video.readyState >= 2;
    },

    update: function() {
        // noop
    },

    reload: function() {
        // noop
    },

    prepare: function() {
        if (!this._loaded) return;
        if (this.video.readyState < 2) return; // not enough data for current position

        var gl = this.map.painter.gl;
        if (!this.tile.texture) {
            this.tile.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
        }

        this._currentTime = this.video.currentTime;
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
            type: 'video',
            urls: this.urls,
            coordinates: this.coordinates
        };
    }
});
