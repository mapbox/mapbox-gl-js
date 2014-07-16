'use strict';

var Tile = require('./tile.js');
var LatLng = require('../geometry/latlng.js');
var Point = require('point-geometry');
var util = require('../util/util.js');

module.exports = VideoSource;

function VideoSource(options) {

    this.video = document.createElement('video');
    this.video.crossOrigin = 'Anonymous';
    this.video.loop = true;

    var urls = (typeof options.url === 'string') ? [options.url] : options.url;

    for (var i = 0; i < urls.length; i++) {
        var s = document.createElement('source');
        s.src = urls[i];
        this.video.appendChild(s);
    }

    this.coordinates = options.coordinates;
    this.enabled = true;

    var loopID;
    var source = this;

    // start repainting when video starts playing
    this.video.addEventListener('playing', function() {
        loopID = source.map.style.animationLoop.set(Infinity);
        source.map._rerender();
    });

    // stop repainting when video stops
    this.video.addEventListener('pause', function() {
        source.map.style.animationLoop.cancel(loopID);
    });

}

VideoSource.prototype.onAdd = function(map) {
    this.map = map;
    this.video.play();
    this.createTile();
};

VideoSource.prototype.createTile = function() {
    /*
     * Calculate which mercator tile is suitable for rendering the video in
     * and create a buffer with the corner coordinates. These coordinates
     * may be outside the tile, because raster tiles aren't clipped when rendering.
     */
    var map = this.map;
    var coords = this.coordinates.map(function(latlng) {
        var loc = LatLng.convert(latlng);
        return util.zoomTo(map.transform.locationCoordinate(loc), 0);
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
    var center = util.zoomTo({
        column: (minX + maxX) / 2,
        row: (minY + maxY) / 2,
        zoom: 0
    }, Math.floor(-Math.log(dMax) / Math.LN2));

    var tileExtent = 4096;
    var tileCoords = coords.map(function(coord) {
        var zoomedCoord = util.zoomTo(coord, center.zoom);
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
    this.boundsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boundsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);

    this.tile = new VideoTile();
    this.center = center;
};

VideoSource.prototype.load = function() {
    // noop
};

VideoSource.prototype.update = function() {
    // noop
};

VideoSource.prototype.render = function(layers) {
    if (!this.enabled) return;
    if (this.video.readyState < 2) return; // not enough data for current position

    var layer = layers[0];

    var bucket = {
        type: 'raster',
        tile: this,
        boundsBuffer: this.boundsBuffer,
        bind: this.bind.bind(this)
    };

    var buckets = {};
    buckets[layer.bucket] = bucket;

    var c = this.center;
    this.tile.calculateMatrices(c.zoom, c.column, c.row, this.map.transform, this.map.painter);
    this.map.painter.tile = this.tile;
    this.map.painter.applyStyle(layer, this.map.style, buckets, {});
};

VideoSource.prototype.bind = function(gl) {

    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
    }

};


VideoSource.prototype.featuresAt = function(point, params, callback) {
    // TODO return pixel?
    return callback(null, []);
};

function VideoTile() {}
VideoTile.prototype = Object.create(Tile);
