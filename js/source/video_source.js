'use strict';

var util = require('../util/util');
var Tile = require('./tile');
var LatLng = require('../geo/lat_lng');
var Point = require('point-geometry');
var Evented = require('../util/evented');
var Coordinate = require('../geo/coordinate');
var TileCoord = require('./tile_coord');
var ajax = require('../util/ajax');

module.exports = VideoSource;

/**
 * Create a Video data source instance given an options object
 * @class VideoSource
 * @param {Object} [options]
 * @param {String|Array} options.url A string or array of URL(s) to video files
 * @param {Array} options.coordinates lat,lng coordinates in order clockwise starting at the top left: tl, tr, br, bl
 * @example
 * var sourceObj = new mapboxgl.VideoSource({
 *    url: [
 *        'https://www.mapbox.com/videos/baltimore-smoke.mp4',
 *        'https://www.mapbox.com/videos/baltimore-smoke.webm'
 *    ],
 *    coordinates: [
 *        [39.18579907229748, -76.54335737228394],
 *        [39.1838364847587, -76.52803659439087],
 *        [39.17683392507606, -76.5295386314392],
 *        [39.17876344106642, -76.54520273208618]
 *    ]
 * });
 * map.addSource('some id', sourceObj); // add
 * map.removeSource('some id');  // remove
 */
function VideoSource(options) {
    this.coordinates = options.coordinates;

    ajax.getVideo(options.url, function(err, video) {
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
            this.createTile();
            this.fire('change');
        }
    }.bind(this));
}

VideoSource.prototype = util.inherit(Evented, {
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
            this.createTile();
        }
    },

    createTile: function() {
        /*
         * Calculate which mercator tile is suitable for rendering the video in
         * and create a buffer with the corner coordinates. These coordinates
         * may be outside the tile, because raster tiles aren't clipped when rendering.
         */
        var map = this.map;
        var coords = this.coordinates.map(function(latlng) {
            var loc = LatLng.convert(latlng);
            return map.transform.locationCoordinate(loc).zoomTo(0);
        });

        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;

        for (var i = 0; i < coords.length; i++) {
            minX = Math.min(minX, coords[i].column);
            minY = Math.min(minY, coords[i].row);
            maxX = Math.max(maxX, coords[i].column);
            maxY = Math.max(maxY, coords[i].row);
        }

        var dx = maxX - minX;
        var dy = maxY - minY;
        var dMax = Math.max(dx, dy);
        var center = new Coordinate((minX + maxX) / 2, (minY + maxY) / 2, 0)
            .zoomTo(Math.floor(-Math.log(dMax) / Math.LN2));

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

        this.tile = new Tile(new TileCoord(center.zoom, center.column, center.row), 512, Infinity);
        this.tile.buckets = {};

        this.tile.boundsBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tile.boundsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    },

    loaded: function() {
        return this.video && this.video.readyState >= 2;
    },

    update: function() {
        // noop
    },

    renderedTiles: function() {
        // not enough data for current position
        if (!this._loaded || this.video.readyState < 2) return [];

        var gl = this.map.painter.gl;
        if (!this.tile.texture) {
            this.tile.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
        } else if (this._currentTime !== this.video.currentTime) {
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
        }

        this._currentTime = this.video.currentTime;

        return [this.tile];
    },

    featuresAt: function(point, params, callback) {
        return callback(null, []);
    }
});
