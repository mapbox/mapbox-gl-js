'use strict';

const util = require('../util/util');
const window = require('../util/window');
const TileCoord = require('./tile_coord');
const LngLat = require('../geo/lng_lat');
const Point = require('point-geometry');
const Evented = require('../util/evented');
const ajax = require('../util/ajax');
const EXTENT = require('../data/extent');
const RasterBoundsArray = require('../data/raster_bounds_array');
const Buffer = require('../data/buffer');
const VertexArrayObject = require('../render/vertex_array_object');

/**
 * A data source containing an image.
 * (See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-image) for detailed documentation of options.)
 *
 * @interface ImageSource
 * @example
 * // add to map
 * map.addSource('some id', {
 *    type: 'image',
 *    url: 'https://www.mapbox.com/images/foo.png',
 *    coordinates: [
 *        [-76.54, 39.18],
 *        [-76.52, 39.18],
 *        [-76.52, 39.17],
 *        [-76.54, 39.17]
 *    ]
 * });
 *
 * // update
 * var mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * map.removeSource('some id');  // remove
 * @see [Add an image](https://www.mapbox.com/mapbox-gl-js/example/image-on-a-map/)
 */
class ImageSource extends Evented {

    constructor(id, options, dispatcher, eventedParent) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.coordinates = options.coordinates;

        this.type = 'image';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;

        this.setEventedParent(eventedParent);

        this.options = options;
    }

    load() {
        this.fire('dataloading', {dataType: 'source'});

        this.url = this.options.url;

        ajax.getImage(this.options.url, (err, image) => {
            if (err) return this.fire('error', {error: err});

            this.image = image;

            this._finishLoading();
        });
    }

    _finishLoading() {
        this.fire('source.load');

        if (this.map) {
            this.setCoordinates(this.coordinates);
        }
    }

    onAdd(map) {
        this.load();
        this.map = map;
        if (this.image) {
            this.setCoordinates(this.coordinates);
        }
    }

    /**
     * Sets the image's coordinates and re-renders the map.
     *
     * @param {Array<Array<number>>} coordinates Four geographical coordinates,
     *   represented as arrays of longitude and latitude numbers, which define the corners of the image.
     *   The coordinates start at the top left corner of the image and proceed in clockwise order.
     *   They do not have to represent a rectangle.
     * @returns {ImageSource} this
     */
    setCoordinates(coordinates) {
        this.coordinates = coordinates;

        // Calculate which mercator tile is suitable for rendering the video in
        // and create a buffer with the corner coordinates. These coordinates
        // may be outside the tile, because raster tiles aren't clipped when rendering.

        const map = this.map;
        const cornerZ0Coords = coordinates.map((coord) => {
            return map.transform.locationCoordinate(LngLat.convert(coord)).zoomTo(0);
        });

        const centerCoord = this.centerCoord = util.getCoordinatesCenter(cornerZ0Coords);
        centerCoord.column = Math.round(centerCoord.column);
        centerCoord.row = Math.round(centerCoord.row);

        this.minzoom = this.maxzoom = centerCoord.zoom;
        this.coord = new TileCoord(centerCoord.zoom, centerCoord.column, centerCoord.row);
        this._tileCoords = cornerZ0Coords.map((coord) => {
            const zoomedCoord = coord.zoomTo(centerCoord.zoom);
            return new Point(
                Math.round((zoomedCoord.column - centerCoord.column) * EXTENT),
                Math.round((zoomedCoord.row - centerCoord.row) * EXTENT));
        });

        this.fire('data', {dataType: 'source'});
        return this;
    }

    _setTile(tile) {
        this.tile = tile;
        const maxInt16 = 32767;
        const array = new RasterBoundsArray();
        array.emplaceBack(this._tileCoords[0].x, this._tileCoords[0].y, 0, 0);
        array.emplaceBack(this._tileCoords[1].x, this._tileCoords[1].y, maxInt16, 0);
        array.emplaceBack(this._tileCoords[3].x, this._tileCoords[3].y, 0, maxInt16);
        array.emplaceBack(this._tileCoords[2].x, this._tileCoords[2].y, maxInt16, maxInt16);

        this.tile.buckets = {};

        this.tile.boundsBuffer = Buffer.fromStructArray(array, Buffer.BufferType.VERTEX);
        this.tile.boundsVAO = new VertexArrayObject();
    }

    prepare() {
        if (!this.tile || !this.image) return;
        this._prepareImage(this.map.painter.gl, this.image);
    }

    _prepareImage(gl, image, resize) {
        if (this.tile.state !== 'loaded') {
            this.tile.state = 'loaded';
            this.tile.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        } else if (resize) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        } else if (image instanceof window.HTMLVideoElement || image instanceof window.ImageData || image instanceof window.HTMLCanvasElement) {
            gl.bindTexture(gl.TEXTURE_2D, this.tile.texture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
        }
    }

    loadTile(tile, callback) {
        // We have a single tile -- whoose coordinates are this.coord -- that
        // covers the image we want to render.  If that's the one being
        // requested, set it up with the image; otherwise, mark the tile as
        // `errored` to indicate that we have no data for it.
        if (this.coord && this.coord.toString() === tile.coord.toString()) {
            this._setTile(tile);
            callback(null);
        } else {
            tile.state = 'errored';
            callback(null);
        }
    }

    serialize() {
        return {
            type: 'image',
            urls: this.url,
            coordinates: this.coordinates
        };
    }
}

module.exports = ImageSource;
