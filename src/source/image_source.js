// @flow

import {CanonicalTileID} from './tile_id.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';
import {lowerBound, upperBound} from '../util/util.js';
import {getImage, ResourceType} from '../util/ajax.js';
import EXTENT from '../style-spec/data/extent.js';
import {RasterBoundsArray, TriangleIndexArray} from '../data/array_types.js';
import boundsAttributes from '../data/bounds_attributes.js';
import SegmentVector from '../data/segment.js';
import Texture, {UserManagedTexture} from '../render/texture.js';
import MercatorCoordinate, {MAX_MERCATOR_LATITUDE} from '../geo/mercator_coordinate.js';
import browser from '../util/browser.js';
import tileTransform, {getTilePoint} from '../geo/projection/tile_transform.js';
import {GLOBE_VERTEX_GRID_SIZE} from '../geo/projection/globe_constants.js';
import {mat3, vec3} from 'gl-matrix';
import LngLat from '../geo/lng_lat.js';

import type {Source} from './source.js';
import type {CanvasSourceSpecification} from './canvas_source.js';
import type Map from '../ui/map.js';
import type Dispatcher from '../util/dispatcher.js';
import type Tile from './tile.js';
import type {Callback} from '../types/callback.js';
import type {Cancelable} from '../types/cancelable.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type {ProjectedPoint} from '../geo/projection/projection.js';
import type {
    ImageSourceSpecification,
    VideoSourceSpecification
} from '../style-spec/types.js';
import type Context from '../gl/context.js';
import assert from "assert";

type Coordinates = [[number, number], [number, number], [number, number], [number, number]];
type ImageSourceTexture = {|
    dimensions: [number, number],
    handle: WebGLTexture
|};

// perspective correction for texture mapping, see https://github.com/mapbox/mapbox-gl-js/issues/9158
// adapted from https://math.stackexchange.com/a/339033/48653

// Creates a matrix that maps
// (1, 0, 0) -> (a * x1, a * y1, a)
// (0, 1, 0) -> (b * x2, b * y2, b)
// (0, 0, 1) -> (c * x3, c * y3, c)
// (1, 1, 1) -> (x4, y4, 1)
function basisToPoints(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    const m = [x1, y1, 1, x2, y2, 1, x3, y3, 1];
    const s = [x4, y4, 1];
    const ma = mat3.adjoint([], m);
    const [sx, sy, sz] = vec3.transformMat3(s, s, ma);
    return mat3.multiply(m, m, [sx, 0, 0, 0, sy, 0, 0, 0, sz]);
}

function getTileToTextureTransformMatrix(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    const a = basisToPoints(0, 0, 1, 0, 1, 1, 0, 1);
    const b = basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4);
    const adjB = mat3.adjoint([], b);
    return mat3.multiply(a, a, adjB);
}

function getTextureToTileTransformMatrix(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    const a = basisToPoints(0, 0, 1, 0, 1, 1, 0, 1);
    const b = basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4);
    const adjA = mat3.adjoint([], a);
    return mat3.multiply(b, b, adjA);
}

function getPerspectiveTransform(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    const m = getTextureToTileTransformMatrix(x1, y1, x2, y2, x3, y3, x4, y4);
    return [
        m[2] / m[8] / EXTENT,
        m[5] / m[8] / EXTENT
    ];
}

function isConvex(coords: [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint]) {
    const dx1 = coords[1].x - coords[0].x;
    const dy1 = coords[1].y - coords[0].y;
    const dx2 = coords[2].x - coords[1].x;
    const dy2 = coords[2].y - coords[1].y;
    const dx3 = coords[3].x - coords[2].x;
    const dy3 = coords[3].y - coords[2].y;
    const dx4 = coords[0].x - coords[3].x;
    const dy4 = coords[0].y - coords[3].y;

    const crossProduct1 = dx1 * dy2 - dx2 * dy1;
    const crossProduct2 = dx2 * dy3 - dx3 * dy2;
    const crossProduct3 = dx3 * dy4 - dx4 * dy3;
    const crossProduct4 = dx4 * dy1 - dx1 * dy4;

    return (crossProduct1 > 0 && crossProduct2 > 0 && crossProduct3 > 0 && crossProduct4 > 0) ||
        (crossProduct1 < 0 && crossProduct2 < 0 && crossProduct3 < 0 && crossProduct4 < 0);
}

function constrainCoordinates(coords: [number, number]) {
    return [coords[0], Math.min(Math.max(coords[1], -MAX_MERCATOR_LATITUDE), MAX_MERCATOR_LATITUDE)];
}

function constrain(coords: Coordinates) {
    return [
        constrainCoordinates(coords[0]),
        constrainCoordinates(coords[1]),
        constrainCoordinates(coords[2]),
        constrainCoordinates(coords[3])];
}

function calculateMinAndSize(coords: Coordinates) {
    let minX = coords[0][0];
    let maxX = minX;
    let minY = coords[0][1];
    let maxY = minY;

    for (let i = 1; i < coords.length; i++) {
        if (coords[i][0] < minX) {
            minX = coords[i][0];
        } else if (coords[i][0] > maxX) {
            maxX = coords[i][0];
        }
        if (coords[i][1] < minY) {
            minY = coords[i][1];
        } else if (coords[i][1] > maxY) {
            maxY = coords[i][1];
        }
    }
    return [minX, minY, maxX - minX, maxY - minY];
}

function calculateMinAndSizeForPoints(coords: ProjectedPoint[]) {
    let minX = coords[0].x;
    let maxX = minX;
    let minY = coords[0].y;
    let maxY = minY;

    for (let i = 1; i < coords.length; i++) {
        if (coords[i].x < minX) {
            minX = coords[i].x;
        } else if (coords[i].x > maxX) {
            maxX = coords[i].x;
        }
        if (coords[i].y < minY) {
            minY = coords[i].y;
        } else if (coords[i].y > maxY) {
            maxY = coords[i].y;
        }
    }
    return [minX, minY, maxX - minX, maxY - minY];
}

function sortTriangles(centerLatitudes: number[], indices: TriangleIndexArray): [number[], TriangleIndexArray] {
    const triangleCount = centerLatitudes.length;
    assert(indices.length === triangleCount);

    // Sorting triangles
    const triangleIndexes = Array.from({length: triangleCount}, (v, i) => i);

    triangleIndexes.sort((idx1: number, idx2: number) => {
        return centerLatitudes[idx1] - centerLatitudes[idx2];
    });

    const sortedCenterLatitudes = [];
    const sortedIndices = new TriangleIndexArray();

    for (let i = 0; i < triangleIndexes.length; i++) {
        const idx = triangleIndexes[i];
        sortedCenterLatitudes.push(centerLatitudes[idx]);
        const i0 = idx * 3;
        const i1 = i0 + 1;
        const i2 = i1 + 1;
        sortedIndices.emplaceBack(indices.uint16[i0], indices.uint16[i1], indices.uint16[i2]);
    }

    return [sortedCenterLatitudes, sortedIndices];
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
    scope: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    url: ?string;
    width: number;
    height: number;

    coordinates: Coordinates;
    tiles: {[_: string]: Tile};
    options: any;
    dispatcher: Dispatcher;
    map: Map;
    texture: Texture | UserManagedTexture | null;
    image: HTMLImageElement | ImageBitmap | ImageData;
    // $FlowFixMe
    tileID: ?CanonicalTileID;
    onNorthPole: boolean;
    onSouthPole: boolean;
    _unsupportedCoords: boolean;
    _boundsArray: ?RasterBoundsArray;
    boundsBuffer: ?VertexBuffer;
    boundsSegments: ?SegmentVector;
    elevatedGlobeVertexBuffer: ?VertexBuffer;
    elevatedGlobeIndexBuffer: ?IndexBuffer;
    elevatedGlobeSegments: ?SegmentVector;
    elevatedGlobeTrianglesCenterLongitudes: ?number[];
    maxLongitudeTriangleSize: number;
    elevatedGlobeGridMatrix: ?Float32Array;
    _loaded: boolean;
    _dirty: boolean;
    _imageRequest: ?Cancelable;
    perspectiveTransform: [number, number];
    elevatedGlobePerspectiveTransform: [number, number];

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
        this.onNorthPole = false;
        this.onSouthPole = false;

        this.setEventedParent(eventedParent);

        this.options = options;
        this._dirty = false;
    }

    load(newCoordinates?: Coordinates, loaded?: boolean) {
        this._loaded = loaded || false;
        this.fire(new Event('dataloading', {dataType: 'source'}));

        this.url = this.options.url;
        if (!this.url) {
            if (newCoordinates) {
                this.coordinates = newCoordinates;
            }
            this._loaded = true;
            this._finishLoading();
            return;
        }

        this._imageRequest = getImage(this.map._requestManager.transformRequest(this.url, ResourceType.Image), (err, image) => {
            this._imageRequest = null;
            this._loaded = true;
            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (image) {
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
     *     represented as arrays of longitude and latitude numbers, which define the corners of the image.
     *     The coordinates start at the top left corner of the image and proceed in clockwise order.
     *     They do not have to represent a rectangle.
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
        if (!options.url) {
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

    setTexture(texture: ImageSourceTexture): this {
        if (!(texture.handle instanceof WebGLTexture)) {
            throw new Error(`The provided handle is not a WebGLTexture instance`);
        }
        const context = this.map.painter.context;
        this.texture = new UserManagedTexture(context, texture.handle);
        this.width = texture.dimensions[0];
        this.height = texture.dimensions[1];
        this._dirty = false;
        this._loaded = true;
        this._finishLoading();
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
        if (this.texture && !(this.texture instanceof UserManagedTexture)) this.texture.destroy();
        if (this.boundsBuffer) {
            this.boundsBuffer.destroy();
            if (this.elevatedGlobeVertexBuffer) {
                this.elevatedGlobeVertexBuffer.destroy();
            }
            if (this.elevatedGlobeIndexBuffer) {
                this.elevatedGlobeIndexBuffer.destroy();
            }
        }
    }

    /**
     * Sets the image's coordinates and re-renders the map.
     *
     * @param {Array<Array<number>>} coordinates Four geographical coordinates,
     *     represented as arrays of longitude and latitude numbers, which define the corners of the image.
     *     The coordinates start at the top left corner of the image and proceed in clockwise order.
     *     They do not have to represent a rectangle.
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
        this._unsupportedCoords = false;

        if (!coordinates.length) {
            assert(false);
            return this;
        }
        this.onNorthPole = false;
        this.onSouthPole = false;
        let minLat = coordinates[0][1];
        let maxLat = coordinates[0][1];
        for (const coord of coordinates) {
            if (coord[1] > maxLat) {
                maxLat = coord[1];
            }
            if (coord[1] < minLat) {
                minLat = coord[1];
            }
        }
        const midLat = (maxLat + minLat) / 2.0;
        if (midLat > MAX_MERCATOR_LATITUDE) {
            this.onNorthPole = true;
        } else if (midLat < -MAX_MERCATOR_LATITUDE) {
            this.onSouthPole = true;
        }

        if (!this.onNorthPole && !this.onSouthPole) {
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
        }

        this.fire(new Event('data', {dataType:'source', sourceDataType: 'content'}));
        return this;
    }

    // $FlowFixMe[method-unbinding]
    _clear() {
        this._boundsArray = undefined;
        this._unsupportedCoords = false;
    }

    _prepareData(context: Context) {
        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
            }
        }

        if (this._boundsArray || this.onNorthPole || this.onSouthPole || this._unsupportedCoords) return;

        const globalTileTr = tileTransform(new CanonicalTileID(0, 0, 0), this.map.transform.projection);

        const globalTileCoords = [
            globalTileTr.projection.project(this.coordinates[0][0], this.coordinates[0][1]),
            globalTileTr.projection.project(this.coordinates[1][0], this.coordinates[1][1]),
            globalTileTr.projection.project(this.coordinates[2][0], this.coordinates[2][1]),
            globalTileTr.projection.project(this.coordinates[3][0], this.coordinates[3][1])
        ];

        if (!isConvex(globalTileCoords)) {
            console.warn('Image source coordinates are defining non-convex area in the Mercator projection');
            this._unsupportedCoords = true;
            return;
        }

        const tileTr = tileTransform(this.tileID, this.map.transform.projection);

        // Transform the corner coordinates into the coordinate space of our tile.
        const [tl, tr, br, bl] = this.coordinates.map((coord) => {
            const projectedCoord = tileTr.projection.project(coord[0], coord[1]);
            return getTilePoint(tileTr, projectedCoord)._round();
        });

        this.perspectiveTransform = getPerspectiveTransform(tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);

        const boundsArray = this._boundsArray = new RasterBoundsArray();
        boundsArray.emplaceBack(tl.x, tl.y, 0, 0);
        boundsArray.emplaceBack(tr.x, tr.y, EXTENT, 0);
        boundsArray.emplaceBack(bl.x, bl.y, 0, EXTENT);
        boundsArray.emplaceBack(br.x, br.y, EXTENT, EXTENT);

        if (this.boundsBuffer) {
            this.boundsBuffer.destroy();
            if (this.elevatedGlobeVertexBuffer) {
                this.elevatedGlobeVertexBuffer.destroy();
            }
            if (this.elevatedGlobeIndexBuffer) {
                this.elevatedGlobeIndexBuffer.destroy();
            }
        }
        this.boundsBuffer = context.createVertexBuffer(boundsArray, boundsAttributes.members);
        this.boundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        // Creating a mesh for elevated rasters in the globe projection.
        // We want to follow the curve of the globe, but on the same time we can't use and transform
        // grid buffers from globeSharedBuffers for several reasons:
        //   * our mesh in the Mercator projection is non-rectangular (for example, can be rotated),
        //     and the latitude has non-linear dependency from tile y coordinate, so we can't restore
        //     lat/lon just by multiplying a grid matrix and a vertex;
        //   * it has limited precision (neighbour points differ only by 1);
        //   * we also want to store UV coordinates as attributes.
        // Grid coordinates go from 0 to EXTENT and contain transformed longitude/latitude,
        // but the grid itself is linear in tile cooridinates, cause we want to get just the same result as with
        // draped rasters.
        // We calculate UV using matrix for perspective projection for all vertices and also correct UV interpolation
        // inside a triangle in shader.
        // During a transition from the Globe projection to the Mercator projection some triangles becomes stretched.
        // In order to detect and skip these triangles we sort them by their middle longitude.
        // We also calculate the maximum longitude size for triangles, and during rendering we find which triangles
        // are close to the vertical line on the other side of the Globe and skip them - during rendering we can have
        // two draw calls instead of one (draw all before the gap and after) or just one (dropped triangles are at
        // the beginning and at the end of our array).

        const cellCount = GLOBE_VERTEX_GRID_SIZE;
        const lineSize = cellCount + 1;
        const linesCount = cellCount + 1;
        const vertexCount = lineSize * linesCount;
        const triangleCount = cellCount * cellCount * 2;
        const verticesLongitudes = [];
        const constrainedCoordinates = constrain(this.coordinates);
        const [minLng, minLat, lngDiff, latDiff] = calculateMinAndSize(constrainedCoordinates);

        // Vertices
        {
            const elevatedGlobeVertexArray = new RasterBoundsArray();

            const [minX, minY, dx, dy] = calculateMinAndSizeForPoints(globalTileCoords);

            const transformToImagePoint = (coord: ProjectedPoint) => {
                return [(coord.x - minX) / dx, (coord.y - minY) / dy];
            };
            const [p0, p1, p2, p3] = globalTileCoords.map(transformToImagePoint);
            const toUV = getTileToTextureTransformMatrix(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
            this.elevatedGlobePerspectiveTransform = getPerspectiveTransform(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);

            const addVertex = (point: LngLat, tilePoint: ProjectedPoint) => {
                verticesLongitudes.push(point.lng);
                const x = Math.round((point.lng - minLng) / lngDiff * EXTENT);
                const y = Math.round((point.lat - minLat) / latDiff * EXTENT);
                const imagePoint = transformToImagePoint(tilePoint);
                const uv = vec3.transformMat3([], [imagePoint[0], imagePoint[1], 1], toUV);
                const u = Math.round(uv[0] / uv[2] * EXTENT);
                const v = Math.round(uv[1] / uv[2] * EXTENT);
                elevatedGlobeVertexArray.emplaceBack(x, y, u, v);
            };

            const leftDx = globalTileCoords[3].x - globalTileCoords[0].x;
            const leftDy = globalTileCoords[3].y - globalTileCoords[0].y;
            const rightDx = globalTileCoords[2].x - globalTileCoords[1].x;
            const rightDy = globalTileCoords[2].y - globalTileCoords[1].y;

            for (let i = 0; i < linesCount; i++) {
                const linesPart = i / cellCount;
                const startLinePoint = [globalTileCoords[0].x + linesPart * leftDx, globalTileCoords[0].y + linesPart * leftDy];
                const endLinePoint = [globalTileCoords[1].x + linesPart * rightDx, globalTileCoords[1].y + linesPart * rightDy];
                const lineDx = endLinePoint[0] - startLinePoint[0];
                const lineDy = endLinePoint[1] - startLinePoint[1];

                for (let j = 0; j < lineSize; j++) {
                    const linePart = j / cellCount;
                    const point = {x: startLinePoint[0] + lineDx * linePart, y: startLinePoint[1] + lineDy * linePart, z: 0};
                    addVertex(globalTileTr.projection.unproject(point.x, point.y), point);
                }
            }

            this.elevatedGlobeVertexBuffer = context.createVertexBuffer(elevatedGlobeVertexArray, boundsAttributes.members);
        }

        // Indices
        {
            this.maxLongitudeTriangleSize = 0;
            let elevatedGlobeTrianglesCenterLongitudes = [];

            let indices = new TriangleIndexArray();

            const processTriangle = (i0: number, i1: number, i2: number) => {
                indices.emplaceBack(i0, i1, i2);

                const l0 = verticesLongitudes[i0];
                const l1 = verticesLongitudes[i1];
                const l2 = verticesLongitudes[i2];
                const minLongitude = Math.min(Math.min(l0, l1), l2);
                const maxLongitude = Math.max(Math.max(l0, l1), l2);
                const diff = maxLongitude - minLongitude;
                if (diff > this.maxLongitudeTriangleSize) {
                    this.maxLongitudeTriangleSize = diff;
                }
                elevatedGlobeTrianglesCenterLongitudes.push(minLongitude + diff / 2.);
            };

            for (let i = 0; i < cellCount; i++) {
                for (let j = 0; j < cellCount; j++) {
                    // Making indexes the way that after transforming to the Globe projection triangles
                    // on our side will be rotated clockwise.
                    // lon
                    //  ^
                    //  | 2  3
                    //  | 0  1
                    //  +------> lat
                    const i0 = i * lineSize + j;
                    const i1 = i0 + 1;
                    const i2 = i0 + lineSize;
                    const i3 = i2 + 1;
                    processTriangle(i0, i2, i1);
                    processTriangle(i1, i2, i3);
                }
            }

            [elevatedGlobeTrianglesCenterLongitudes, indices] = sortTriangles(elevatedGlobeTrianglesCenterLongitudes, indices);

            this.elevatedGlobeTrianglesCenterLongitudes = elevatedGlobeTrianglesCenterLongitudes;
            this.elevatedGlobeIndexBuffer = context.createIndexBuffer(indices);
        }

        this.elevatedGlobeSegments = SegmentVector.simpleSegment(0, 0, vertexCount, triangleCount);
        this.elevatedGlobeGridMatrix = new Float32Array([0, lngDiff / EXTENT, 0, latDiff / EXTENT, 0, 0, minLat, minLng, 0]);
    }

    // $FlowFixMe[method-unbinding]
    prepare() {
        const hasTiles = Object.keys(this.tiles).length !== 0;
        if (this.tileID && !hasTiles) return;

        const context = this.map.painter.context;
        const gl = context.gl;

        if (this._dirty && !(this.texture instanceof UserManagedTexture)) {
            if (!this.texture) {
                this.texture = new Texture(context, this.image, gl.RGBA);
                this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            } else {
                this.texture.update(this.image);
            }
            this._dirty = false;
        }

        if (!hasTiles) return;
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

    getSegmentsForLongitude(longitude: number): ?SegmentVector {
        const segments = this.elevatedGlobeSegments;
        if (!this.elevatedGlobeTrianglesCenterLongitudes || !segments) {
            return null;
        }
        const longitudes = this.elevatedGlobeTrianglesCenterLongitudes;
        assert(longitudes.length !== 0);

        // Normalizing longitude so that abs(normalizedLongitude - desiredLongitude) <= 180
        const normalizeLongitudeTo = (longitude: number, desiredLongitude: number) => {
            const diff = Math.round((desiredLongitude - longitude) / 360.);
            return longitude + diff * 360.;
        };

        let gapLongitude = normalizeLongitudeTo(longitude + 180., longitudes[0]);
        const ret = new SegmentVector();

        const addTriangleRange = (triangleOffset: number, triangleCount: number) => {
            ret.segments.push(
                {
                    vertexOffset: 0,
                    primitiveOffset: triangleOffset,
                    vertexLength: segments.segments[0].vertexLength,
                    primitiveLength: triangleCount,
                    sortKey: undefined,
                    vaos: {}
                });
        };

        // +0.01 - just to be sure that we don't draw "bad" triangles because of calculation errors
        const distanceToDrop = 0.51 * this.maxLongitudeTriangleSize;
        assert(distanceToDrop > 0);
        assert(distanceToDrop < 180.);

        if (Math.abs(longitudes[0] - gapLongitude) <= distanceToDrop) {
            const minIdx = upperBound(longitudes, 0, longitudes.length, gapLongitude + distanceToDrop);
            if (minIdx === longitudes.length) {
                // Rotated 90 degrees, and one side is almost zero?
                return ret;
            }
            const maxIdx = lowerBound(longitudes, minIdx + 1, longitudes.length, gapLongitude + 360. - distanceToDrop);
            const count = maxIdx - minIdx;
            addTriangleRange(minIdx, count);
            return ret;
        }

        if (gapLongitude < longitudes[0]) {
            gapLongitude += 360.;
        }

        // Looking for the range inside or in the end of our triangles array to skip
        const minIdx = lowerBound(longitudes, 0, longitudes.length, gapLongitude - distanceToDrop);
        if (minIdx === longitudes.length) {
            // Skip nothing
            addTriangleRange(0, longitudes.length);
            return ret;
        }

        addTriangleRange(0, minIdx - 0);

        const maxIdx = upperBound(longitudes, minIdx + 1, longitudes.length, gapLongitude + distanceToDrop);
        if (maxIdx !== longitudes.length) {
            addTriangleRange(maxIdx, longitudes.length - maxIdx);
        }

        return ret;
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

    let x = Math.floor((minX + maxX) / 2 * tilesAtZoom);
    if (x > 1) {
        x -= 1;
    }

    return new CanonicalTileID(
            zoom,
            x,
            Math.floor((minY + maxY) / 2 * tilesAtZoom));
}

export default ImageSource;
