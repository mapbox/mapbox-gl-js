// @flow

import {CanonicalTileID} from './tile_id.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';
import {getImage, ResourceType} from '../util/ajax.js';
import EXTENT from '../data/extent.js';
import {RasterBoundsArray} from '../data/array_types.js';
import boundsAttributes from '../data/bounds_attributes.js';
import SegmentVector from '../data/segment.js';
import Texture from '../render/texture.js';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import browser from '../util/browser.js';
import tileTransform, {getTilePoint} from '../geo/projection/tile_transform.js';
import {mat3, vec3} from 'gl-matrix';
import window from '../util/window.js';

import type {Source} from './source.js';
import type {CanvasSourceSpecification} from './canvas_source.js';
import type Map from '../ui/map.js';
import type Dispatcher from '../util/dispatcher.js';
import type Tile from './tile.js';
import type {Callback} from '../types/callback.js';
import type {Cancelable} from '../types/cancelable.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type {
    ImageSourceSpecification,
    VideoSourceSpecification
} from '../style-spec/types.js';
import type Context from '../gl/context.js';

type Coordinates = [[number, number], [number, number], [number, number], [number, number]];

// perspective correction for texture mapping, see https://github.com/mapbox/mapbox-gl-js/issues/9158
// adapted from https://math.stackexchange.com/a/339033/48653

function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
    const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
    const s = [x4, y4, 1];
    const ma = mat3.adjoint([], m);
    const [sx, sy, sz] = vec3.transformMat3(s, s, mat3.transpose(ma, ma));
    return mat3.multiply(m, [sx, 0, 0, 0, sy, 0, 0, 0, sz], m);
}

function getPerspectiveTransform(w, h, x1, y1, x2, y2, x3, y3, x4, y4) {
    const s = basisToPoints(0, 0, w, 0, 0, h, w, h);
    const m = basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4);
    mat3.multiply(m, mat3.adjoint(s, s), m);
    return [
        m[6] / m[8] * w / EXTENT,
        m[7] / m[8] * h / EXTENT
    ];
}

/**
 * A data source containing an image.
 * See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-image) for detailed documentation of options.
 *
 * @example
 * // add to map
 * map.addSource('some id', {
 *     type: 'image',
 *     url: 'https://www.mapbox.com/images/foo.png',
 *     coordinates: [
 *         [-76.54, 39.18],
 *         [-76.52, 39.18],
 *         [-76.52, 39.17],
 *         [-76.54, 39.17]
 *     ]
 * });
 *
 * // update coordinates
 * const mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * // update url and coordinates simultaneously
 * mySource.updateImage({
 *     url: 'https://www.mapbox.com/images/bar.png',
 *     coordinates: [
 *         [-76.54335737228394, 39.18579907229748],
 *         [-76.52803659439087, 39.1838364847587],
 *         [-76.5295386314392, 39.17683392507606],
 *         [-76.54520273208618, 39.17876344106642]
 *     ]
 * });
 *
 * map.removeSource('some id');  // remove
 * @see [Example: Add an image](https://www.mapbox.com/mapbox-gl-js/example/image-on-a-map/)
 * @see [Example: Animate a series of images](https://www.mapbox.com/mapbox-gl-js/example/animate-images/)
 */
class ImageSource extends Evented implements Source {
    type: string;
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    url: string;
    width: number;
    height: number;

    coordinates: Coordinates;
    tiles: {[_: string]: Tile};
    options: any;
    dispatcher: Dispatcher;
    map: Map;
    texture: Texture | null;
    image: HTMLImageElement | ImageBitmap | ImageData;
    // $FlowFixMe
    tileID: CanonicalTileID;
    _boundsArray: ?RasterBoundsArray;
    boundsBuffer: ?VertexBuffer;
    boundsSegments: ?SegmentVector;
    _loaded: boolean;
    _dirty: boolean;
    _imageRequest: ?Cancelable;
    perspectiveTransform: [number, number];

    /**
     * @private
     */
    constructor(id: string, options: ImageSourceSpecification | VideoSourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.coordinates = options.coordinates;

        this.type = 'image';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.tileSize = 512;
        this.tiles = {};
        this._loaded = false;

        this.setEventedParent(eventedParent);

        this.options = options;
        this._dirty = false;
    }

    load(newCoordinates?: Coordinates, loaded?: boolean) {
        this._loaded = loaded || false;
        this.fire(new Event('dataloading', {dataType: 'source'}));

        this.url = this.options.url;

        this._imageRequest = getImage(this.map._requestManager.transformRequest(this.url, ResourceType.Image), (err, image) => {
            this._imageRequest = null;
            this._loaded = true;
            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (image) {
                const {HTMLImageElement} = window;
                if (image instanceof HTMLImageElement) {
                    this.image = browser.getImageData(image);
                } else {
                    this.image = image;
                }
                this._dirty = true;
                this.width = this.image.width;
                this.height = this.image.height;
                if (newCoordinates) {
                    this.coordinates = newCoordinates;
                }
                this._finishLoading();
            }
        });
    }

    loaded(): boolean {
        return this._loaded;
    }

    /**
     * Updates the image URL and, optionally, the coordinates. To avoid having the image flash after changing,
     * set the `raster-fade-duration` paint property on the raster layer to 0.
     *
     * @param {Object} options Options object.
     * @param {string} [options.url] Required image URL.
     * @param {Array<Array<number>>} [options.coordinates] Four geographical coordinates,
     *   represented as arrays of longitude and latitude numbers, which define the corners of the image.
     *   The coordinates start at the top left corner of the image and proceed in clockwise order.
     *   They do not have to represent a rectangle.
     * @returns {ImageSource} Returns itself to allow for method chaining.
     * @example
     * // Add to an image source to the map with some initial URL and coordinates
     * map.addSource('image_source_id', {
     *     type: 'image',
     *     url: 'https://www.mapbox.com/images/foo.png',
     *     coordinates: [
     *         [-76.54, 39.18],
     *         [-76.52, 39.18],
     *         [-76.52, 39.17],
     *         [-76.54, 39.17]
     *     ]
     * });
     * // Then update the image URL and coordinates
     * imageSource.updateImage({
     *     url: 'https://www.mapbox.com/images/bar.png',
     *     coordinates: [
     *         [-76.5433, 39.1857],
     *         [-76.5280, 39.1838],
     *         [-76.5295, 39.1768],
     *         [-76.5452, 39.1787]
     *     ]
     * });
     */
    updateImage(options: {url: string, coordinates?: Coordinates}): this {
        if (!this.image || !options.url) {
            return this;
        }
        if (this._imageRequest && options.url !== this.options.url) {
            this._imageRequest.cancel();
            this._imageRequest = null;
        }
        this.options.url = options.url;
        this.load(options.coordinates, this._loaded);
        return this;
    }

    _finishLoading() {
        if (this.map) {
            this.setCoordinates(this.coordinates);
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        }
    }

    // $FlowFixMe[method-unbinding]
    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    // $FlowFixMe[method-unbinding]
    onRemove() {
        if (this._imageRequest) {
            this._imageRequest.cancel();
            this._imageRequest = null;
        }
        if (this.texture) this.texture.destroy();
    }

    /**
     * Sets the image's coordinates and re-renders the map.
     *
     * @param {Array<Array<number>>} coordinates Four geographical coordinates,
     *   represented as arrays of longitude and latitude numbers, which define the corners of the image.
     *   The coordinates start at the top left corner of the image and proceed in clockwise order.
     *   They do not have to represent a rectangle.
     * @returns {ImageSource} Returns itself to allow for method chaining.
     * @example
     * // Add an image source to the map with some initial coordinates
     * map.addSource('image_source_id', {
     *     type: 'image',
     *     url: 'https://www.mapbox.com/images/foo.png',
     *     coordinates: [
     *         [-76.54, 39.18],
     *         [-76.52, 39.18],
     *         [-76.52, 39.17],
     *         [-76.54, 39.17]
     *     ]
     * });
     * // Then update the image coordinates
     * imageSource.setCoordinates([
     *     [-76.5433, 39.1857],
     *     [-76.5280, 39.1838],
     *     [-76.5295, 39.1768],
     *     [-76.5452, 39.1787]
     * ]);
     */
    setCoordinates(coordinates: Coordinates): this {
        this.coordinates = coordinates;
        this._boundsArray = undefined;

        // Calculate which mercator tile is suitable for rendering the video in
        // and create a buffer with the corner coordinates. These coordinates
        // may be outside the tile, because raster tiles aren't clipped when rendering.

        // transform the geo coordinates into (zoom 0) tile space coordinates
        // $FlowFixMe[method-unbinding]
        const cornerCoords = coordinates.map(MercatorCoordinate.fromLngLat);

        // Compute the coordinates of the tile we'll use to hold this image's
        // render data
        this.tileID = getCoordinatesCenterTileID(cornerCoords);

        // Constrain min/max zoom to our tile's zoom level in order to force
        // SourceCache to request this tile (no matter what the map's zoom
        // level)
        this.minzoom = this.maxzoom = this.tileID.z;

        this.fire(new Event('data', {dataType:'source', sourceDataType: 'content'}));
        return this;
    }

    // $FlowFixMe[method-unbinding]
    _clear() {
        this._boundsArray = undefined;
    }

    _prepareData(context: Context) {
        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
            }
        }

        if (this._boundsArray) return;

        const tileTr = tileTransform(this.tileID, this.map.transform.projection);

        // Transform the corner coordinates into the coordinate space of our tile.
        const [tl, tr, br, bl] = this.coordinates.map((coord) => {
            const projectedCoord = tileTr.projection.project(coord[0], coord[1]);
            return getTilePoint(tileTr, projectedCoord)._round();
        });

        this.perspectiveTransform = getPerspectiveTransform(
            this.width, this.height, tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y);

        const boundsArray = this._boundsArray = new RasterBoundsArray();
        boundsArray.emplaceBack(tl.x, tl.y, 0, 0);
        boundsArray.emplaceBack(tr.x, tr.y, EXTENT, 0);
        boundsArray.emplaceBack(bl.x, bl.y, 0, EXTENT);
        boundsArray.emplaceBack(br.x, br.y, EXTENT, EXTENT);

        if (this.boundsBuffer) {
            this.boundsBuffer.destroy();
        }
        this.boundsBuffer = context.createVertexBuffer(boundsArray, boundsAttributes.members);
        this.boundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    // $FlowFixMe[method-unbinding]
    prepare() {
        if (Object.keys(this.tiles).length === 0 || !this.image) return;

        const context = this.map.painter.context;
        const gl = context.gl;

        if (this._dirty) {
            if (!this.texture) {
                this.texture = new Texture(context, this.image, gl.RGBA);
                this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            } else {
                this.texture.update(this.image);
            }
            this._dirty = false;
        }

        this._prepareData(context);
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        // We have a single tile -- whoose coordinates are this.tileID -- that
        // covers the image we want to render.  If that's the one being
        // requested, set it up with the image; otherwise, mark the tile as
        // `errored` to indicate that we have no data for it.
        // If the world wraps, we may have multiple "wrapped" copies of the
        // single tile.
        if (this.tileID && this.tileID.equals(tile.tileID.canonical)) {
            this.tiles[String(tile.tileID.wrap)] = tile;
            tile.buckets = {};
            callback(null);
        } else {
            tile.state = 'errored';
            callback(null);
        }
    }

    serialize(): Object {
        return {
            type: 'image',
            url: this.options.url,
            coordinates: this.coordinates
        };
    }

    hasTransition(): boolean {
        return false;
    }
}

/**
 * Given a list of coordinates, get their center as a coordinate.
 *
 * @returns centerpoint
 * @private
 */
export function getCoordinatesCenterTileID(coords: Array<MercatorCoordinate>): CanonicalTileID {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const coord of coords) {
        minX = Math.min(minX, coord.x);
        minY = Math.min(minY, coord.y);
        maxX = Math.max(maxX, coord.x);
        maxY = Math.max(maxY, coord.y);
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dMax = Math.max(dx, dy);
    const zoom = Math.max(0, Math.floor(-Math.log(dMax) / Math.LN2));
    const tilesAtZoom = Math.pow(2, zoom);

    return new CanonicalTileID(
            zoom,
            Math.floor((minX + maxX) / 2 * tilesAtZoom),
            Math.floor((minY + maxY) / 2 * tilesAtZoom));
}

export default ImageSource;
