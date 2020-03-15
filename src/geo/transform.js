// @flow

import LngLat from './lng_lat';
import LngLatBounds from './lng_lat_bounds';
import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from './mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {wrap, clamp} from '../util/util';
import {number as interpolate} from '../style-spec/util/interpolate';
import EXTENT from '../data/extent';
import {vec4, mat4, mat2, vec2} from 'gl-matrix';
import {Aabb, Frustum} from '../util/primitives.js';
import EdgeInsets from './edge_insets';

import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../source/tile_id';
import type {PaddingOptions} from './edge_insets';

/**
 * A single transform, generally used for a single tile to be
 * scaled, rotated, and zoomed.
 * @private
 */
class Transform {
    tileSize: number;
    tileZoom: number;
    lngRange: ?[number, number];
    latRange: ?[number, number];
    maxValidLatitude: number;
    scale: number;
    width: number;
    height: number;
    angle: number;
    rotationMatrix: Float64Array;
    zoomFraction: number;
    pixelsToGLUnits: [number, number];
    cameraToCenterDistance: number;
    mercatorMatrix: Array<number>;
    projMatrix: Float64Array;
    invProjMatrix: Float64Array;
    alignedProjMatrix: Float64Array;
    pixelMatrix: Float64Array;
    pixelMatrixInverse: Float64Array;
    glCoordMatrix: Float32Array;
    labelPlaneMatrix: Float32Array;
    _fov: number;
    _pitch: number;
    _zoom: number;
    _unmodified: boolean;
    _renderWorldCopies: boolean;
    _minZoom: number;
    _maxZoom: number;
    _minPitch: number;
    _maxPitch: number;
    _center: LngLat;
    _edgeInsets: EdgeInsets;
    _constraining: boolean;
    _posMatrixCache: {[_: string]: Float32Array};
    _alignedPosMatrixCache: {[_: string]: Float32Array};

    constructor(minZoom: ?number, maxZoom: ?number, minPitch: ?number, maxPitch: ?number, renderWorldCopies: boolean | void) {
        this.tileSize = 512; // constant
        this.maxValidLatitude = 85.051129; // constant

        this._renderWorldCopies = renderWorldCopies === undefined ? true : renderWorldCopies;
        this._minZoom = minZoom || 0;
        this._maxZoom = maxZoom || 22;

        this._minPitch = (minPitch === undefined || minPitch === null) ? 0 : minPitch;
        this._maxPitch = (maxPitch === undefined || maxPitch === null) ? 60 : maxPitch;

        this.setMaxBounds();

        this.width = 0;
        this.height = 0;
        this._center = new LngLat(0, 0);
        this.zoom = 0;
        this.angle = 0;
        this._fov = 0.6435011087932844;
        this._pitch = 0;
        this._unmodified = true;
        this._edgeInsets = new EdgeInsets();
        this._posMatrixCache = {};
        this._alignedPosMatrixCache = {};
    }

    clone(): Transform {
        const clone = new Transform(this._minZoom, this._maxZoom, this._minPitch, this.maxPitch, this._renderWorldCopies);
        clone.tileSize = this.tileSize;
        clone.latRange = this.latRange;
        clone.width = this.width;
        clone.height = this.height;
        clone._center = this._center;
        clone.zoom = this.zoom;
        clone.angle = this.angle;
        clone._fov = this._fov;
        clone._pitch = this._pitch;
        clone._unmodified = this._unmodified;
        clone._edgeInsets = this._edgeInsets.clone();
        clone._calcMatrices();
        return clone;
    }

    get minZoom(): number { return this._minZoom; }
    set minZoom(zoom: number) {
        if (this._minZoom === zoom) return;
        this._minZoom = zoom;
        this.zoom = Math.max(this.zoom, zoom);
    }

    get maxZoom(): number { return this._maxZoom; }
    set maxZoom(zoom: number) {
        if (this._maxZoom === zoom) return;
        this._maxZoom = zoom;
        this.zoom = Math.min(this.zoom, zoom);
    }

    get minPitch(): number { return this._minPitch; }
    set minPitch(pitch: number) {
        if (this._minPitch === pitch) return;
        this._minPitch = pitch;
        this.pitch = Math.max(this.pitch, pitch);
    }

    get maxPitch(): number { return this._maxPitch; }
    set maxPitch(pitch: number) {
        if (this._maxPitch === pitch) return;
        this._maxPitch = pitch;
        this.pitch = Math.min(this.pitch, pitch);
    }

    get renderWorldCopies(): boolean { return this._renderWorldCopies; }
    set renderWorldCopies(renderWorldCopies?: ?boolean) {
        if (renderWorldCopies === undefined) {
            renderWorldCopies = true;
        } else if (renderWorldCopies === null) {
            renderWorldCopies = false;
        }

        this._renderWorldCopies = renderWorldCopies;
    }

    get worldSize(): number {
        return this.tileSize * this.scale;
    }

    get centerOffset(): Point {
        return this.centerPoint._sub(this.size._div(2));
    }

    get size(): Point {
        return new Point(this.width, this.height);
    }

    get bearing(): number {
        return -this.angle / Math.PI * 180;
    }
    set bearing(bearing: number) {
        const b = -wrap(bearing, -180, 180) * Math.PI / 180;
        if (this.angle === b) return;
        this._unmodified = false;
        this.angle = b;
        this._calcMatrices();

        // 2x2 matrix for rotating points
        this.rotationMatrix = mat2.create();
        mat2.rotate(this.rotationMatrix, this.rotationMatrix, this.angle);
    }

    get pitch(): number {
        return this._pitch / Math.PI * 180;
    }
    set pitch(pitch: number) {
        const p = clamp(pitch, this.minPitch, this.maxPitch) / 180 * Math.PI;
        if (this._pitch === p) return;
        this._unmodified = false;
        this._pitch = p;
        this._calcMatrices();
    }

    get fov(): number {
        return this._fov / Math.PI * 180;
    }
    set fov(fov: number) {
        fov = Math.max(0.01, Math.min(60, fov));
        if (this._fov === fov) return;
        this._unmodified = false;
        this._fov = fov / 180 * Math.PI;
        this._calcMatrices();
    }

    get zoom(): number { return this._zoom; }
    set zoom(zoom: number) {
        const z = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
        if (this._zoom === z) return;
        this._unmodified = false;
        this._zoom = z;
        this.scale = this.zoomScale(z);
        this.tileZoom = Math.floor(z);
        this.zoomFraction = z - this.tileZoom;
        this._constrain();
        this._calcMatrices();
    }

    get center(): LngLat { return this._center; }
    set center(center: LngLat) {
        if (center.lat === this._center.lat && center.lng === this._center.lng) return;
        this._unmodified = false;
        this._center = center;
        this._constrain();
        this._calcMatrices();
    }

    get padding(): PaddingOptions { return this._edgeInsets.toJSON(); }
    set padding(padding: PaddingOptions) {
        if (this._edgeInsets.equals(padding)) return;
        this._unmodified = false;
        //Update edge-insets inplace
        this._edgeInsets.interpolate(this._edgeInsets, padding, 1);
        this._calcMatrices();
    }

    /**
     * The center of the screen in pixels with the top-left corner being (0,0)
     * and +y axis pointing downwards. This accounts for padding.
     *
     * @readonly
     * @type {Point}
     * @memberof Transform
     */
    get centerPoint(): Point {
        return this._edgeInsets.getCenter(this.width, this.height);
    }

    /**
     * Returns if the padding params match
     *
     * @param {PaddingOptions} padding
     * @returns {boolean}
     * @memberof Transform
     */
    isPaddingEqual(padding: PaddingOptions): boolean {
        return this._edgeInsets.equals(padding);
    }

    /**
     * Helper method to upadte edge-insets inplace
     *
     * @param {PaddingOptions} target
     * @param {number} t
     * @memberof Transform
     */
    interpolatePadding(start: PaddingOptions, target: PaddingOptions, t: number) {
        this._unmodified = false;
        this._edgeInsets.interpolate(start, target, t);
        this._constrain();
        this._calcMatrices();
    }

    /**
     * Return a zoom level that will cover all tiles the transform
     * @param {Object} options options
     * @param {number} options.tileSize Tile size, expressed in screen pixels.
     * @param {boolean} options.roundZoom Target zoom level. If true, the value will be rounded to the closest integer. Otherwise the value will be floored.
     * @returns {number} zoom level An integer zoom level at which all tiles will be visible.
     */
    coveringZoomLevel(options: {roundZoom?: boolean, tileSize: number}) {
        const z = (options.roundZoom ? Math.round : Math.floor)(
            this.zoom + this.scaleZoom(this.tileSize / options.tileSize)
        );
        // At negative zoom levels load tiles from z0 because negative tile zoom levels don't exist.
        return Math.max(0, z);
    }

    /**
     * Return any "wrapped" copies of a given tile coordinate that are visible
     * in the current view.
     *
     * @private
     */
    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID) {
        const result = [new UnwrappedTileID(0, tileID)];
        if (this._renderWorldCopies) {
            const utl = this.pointCoordinate(new Point(0, 0));
            const utr = this.pointCoordinate(new Point(this.width, 0));
            const ubl = this.pointCoordinate(new Point(this.width, this.height));
            const ubr = this.pointCoordinate(new Point(0, this.height));
            const w0 = Math.floor(Math.min(utl.x, utr.x, ubl.x, ubr.x));
            const w1 = Math.floor(Math.max(utl.x, utr.x, ubl.x, ubr.x));

            // Add an extra copy of the world on each side to properly render ImageSources and CanvasSources.
            // Both sources draw outside the tile boundaries of the tile that "contains them" so we need
            // to add extra copies on both sides in case offscreen tiles need to draw into on-screen ones.
            const extraWorldCopy = 1;

            for (let w = w0 - extraWorldCopy; w <= w1 + extraWorldCopy; w++) {
                if (w === 0) continue;
                result.push(new UnwrappedTileID(w, tileID));
            }
        }
        return result;
    }

    /**
     * Return all coordinates that could cover this transform for a covering
     * zoom level.
     * @param {Object} options
     * @param {number} options.tileSize
     * @param {number} options.minzoom
     * @param {number} options.maxzoom
     * @param {boolean} options.roundZoom
     * @param {boolean} options.reparseOverscaled
     * @param {boolean} options.renderWorldCopies
     * @returns {Array<OverscaledTileID>} OverscaledTileIDs
     * @private
     */
    coveringTiles(
        options: {
            tileSize: number,
            minzoom?: number,
            maxzoom?: number,
            roundZoom?: boolean,
            reparseOverscaled?: boolean,
            renderWorldCopies?: boolean
        }
    ): Array<OverscaledTileID> {
        let z = this.coveringZoomLevel(options);
        const actualZ = z;

        if (options.minzoom !== undefined && z < options.minzoom) return [];
        if (options.maxzoom !== undefined && z > options.maxzoom) z = options.maxzoom;

        const centerCoord = MercatorCoordinate.fromLngLat(this.center);
        const numTiles = Math.pow(2, z);
        const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
        const cameraFrustum = Frustum.fromInvProjectionMatrix(this.invProjMatrix, this.worldSize, z);

        // No change of LOD behavior for pitch lower than 60 and when there is no top padding: return only tile ids from the requested zoom level
        let minZoom = options.minzoom || 0;
        // Use 0.1 as an epsilon to avoid for explicit == 0.0 floating point checks
        if (this.pitch <= 60.0 && this._edgeInsets.top < 0.1)
            minZoom = z;

        // There should always be a certain number of maximum zoom level tiles surrounding the center location
        const radiusOfMaxLvlLodInTiles = 3;

        const newRootTile = (wrap: number): any => {
            return {
                // All tiles are on zero elevation plane => z difference is zero
                aabb: new Aabb([wrap * numTiles, 0, 0], [(wrap + 1) * numTiles, numTiles, 0]),
                zoom: 0,
                x: 0,
                y: 0,
                wrap,
                fullyVisible: false
            };
        };

        // Do a depth-first traversal to find visible tiles and proper levels of detail
        const stack = [];
        const result = [];
        const maxZoom = z;
        const overscaledZ = options.reparseOverscaled ? actualZ : z;

        if (this._renderWorldCopies) {
            // Render copy of the globe thrice on both sides
            for (let i = 1; i <= 3; i++) {
                stack.push(newRootTile(-i));
                stack.push(newRootTile(i));
            }
        }

        stack.push(newRootTile(0));

        while (stack.length > 0) {
            const it = stack.pop();
            const x = it.x;
            const y = it.y;
            let fullyVisible = it.fullyVisible;

            // Visibility of a tile is not required if any of its ancestor if fully inside the frustum
            if (!fullyVisible) {
                const intersectResult = it.aabb.intersects(cameraFrustum);

                if (intersectResult === 0)
                    continue;

                fullyVisible = intersectResult === 2;
            }

            const distanceX = it.aabb.distanceX(centerPoint);
            const distanceY = it.aabb.distanceY(centerPoint);
            const longestDim = Math.max(Math.abs(distanceX), Math.abs(distanceY));

            // We're using distance based heuristics to determine if a tile should be split into quadrants or not.
            // radiusOfMaxLvlLodInTiles defines that there's always a certain number of maxLevel tiles next to the map center.
            // Using the fact that a parent node in quadtree is twice the size of its children (per dimension)
            // we can define distance thresholds for each relative level:
            // f(k) = offset + 2 + 4 + 8 + 16 + ... + 2^k. This is the same as "offset+2^(k+1)-2"
            const distToSplit = radiusOfMaxLvlLodInTiles + (1 << (maxZoom - it.zoom)) - 2;

            // Have we reached the target depth or is the tile too far away to be any split further?
            if (it.zoom === maxZoom || (longestDim > distToSplit && it.zoom >= minZoom)) {
                result.push({
                    tileID: new OverscaledTileID(it.zoom === maxZoom ? overscaledZ : it.zoom, it.wrap, it.zoom, x, y),
                    distanceSq: vec2.sqrLen([centerPoint[0] - 0.5 - x, centerPoint[1] - 0.5 - y])
                });
                continue;
            }

            for (let i = 0; i < 4; i++) {
                const childX = (x << 1) + (i % 2);
                const childY = (y << 1) + (i >> 1);

                stack.push({aabb: it.aabb.quadrant(i), zoom: it.zoom + 1, x: childX, y: childY, wrap: it.wrap, fullyVisible});
            }
        }

        return result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
    }

    resize(width: number, height: number) {
        this.width = width;
        this.height = height;

        this.pixelsToGLUnits = [2 / width, -2 / height];
        this._constrain();
        this._calcMatrices();
    }

    get unmodified(): boolean { return this._unmodified; }

    zoomScale(zoom: number) { return Math.pow(2, zoom); }
    scaleZoom(scale: number) { return Math.log(scale) / Math.LN2; }

    project(lnglat: LngLat) {
        const lat = clamp(lnglat.lat, -this.maxValidLatitude, this.maxValidLatitude);
        return new Point(
                mercatorXfromLng(lnglat.lng) * this.worldSize,
                mercatorYfromLat(lat) * this.worldSize);
    }

    unproject(point: Point): LngLat {
        return new MercatorCoordinate(point.x / this.worldSize, point.y / this.worldSize).toLngLat();
    }

    get point(): Point { return this.project(this.center); }

    setLocationAtPoint(lnglat: LngLat, point: Point) {
        const a = this.pointCoordinate(point);
        const b = this.pointCoordinate(this.centerPoint);
        const loc = this.locationCoordinate(lnglat);
        const newCenter = new MercatorCoordinate(
                loc.x - (a.x - b.x),
                loc.y - (a.y - b.y));
        this.center = this.coordinateLocation(newCenter);
        if (this._renderWorldCopies) {
            this.center = this.center.wrap();
        }
    }

    /**
     * Given a location, return the screen point that corresponds to it
     * @param {LngLat} lnglat location
     * @returns {Point} screen point
     * @private
     */
    locationPoint(lnglat: LngLat) {
        return this.coordinatePoint(this.locationCoordinate(lnglat));
    }

    /**
     * Given a point on screen, return its lnglat
     * @param {Point} p screen point
     * @returns {LngLat} lnglat location
     * @private
     */
    pointLocation(p: Point) {
        return this.coordinateLocation(this.pointCoordinate(p));
    }

    /**
     * Given a geographical lnglat, return an unrounded
     * coordinate that represents it at this transform's zoom level.
     * @param {LngLat} lnglat
     * @returns {Coordinate}
     * @private
     */
    locationCoordinate(lnglat: LngLat) {
        return MercatorCoordinate.fromLngLat(lnglat);
    }

    /**
     * Given a Coordinate, return its geographical position.
     * @param {Coordinate} coord
     * @returns {LngLat} lnglat
     * @private
     */
    coordinateLocation(coord: MercatorCoordinate) {
        return coord.toLngLat();
    }

    pointCoordinate(p: Point) {
        const targetZ = 0;
        // since we don't know the correct projected z value for the point,
        // unproject two points to get a line and then find the point on that
        // line with z=0

        const coord0 = [p.x, p.y, 0, 1];
        const coord1 = [p.x, p.y, 1, 1];

        vec4.transformMat4(coord0, coord0, this.pixelMatrixInverse);
        vec4.transformMat4(coord1, coord1, this.pixelMatrixInverse);

        const w0 = coord0[3];
        const w1 = coord1[3];
        const x0 = coord0[0] / w0;
        const x1 = coord1[0] / w1;
        const y0 = coord0[1] / w0;
        const y1 = coord1[1] / w1;
        const z0 = coord0[2] / w0;
        const z1 = coord1[2] / w1;

        const t = z0 === z1 ? 0 : (targetZ - z0) / (z1 - z0);

        return new MercatorCoordinate(
            interpolate(x0, x1, t) / this.worldSize,
            interpolate(y0, y1, t) / this.worldSize);
    }

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param {Coordinate} coord
     * @returns {Point} screen point
     * @private
     */
    coordinatePoint(coord: MercatorCoordinate) {
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, 0, 1];
        vec4.transformMat4(p, p, this.pixelMatrix);
        return new Point(p[0] / p[3], p[1] / p[3]);
    }

    /**
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     * @returns {LngLatBounds} Returns a {@link LngLatBounds} object describing the map's geographical bounds.
     */
    getBounds(): LngLatBounds {
        return new LngLatBounds()
            .extend(this.pointLocation(new Point(0, 0)))
            .extend(this.pointLocation(new Point(this.width, 0)))
            .extend(this.pointLocation(new Point(this.width, this.height)))
            .extend(this.pointLocation(new Point(0, this.height)));
    }

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     * @returns {LngLatBounds} {@link LngLatBounds}
     */
    getMaxBounds(): LngLatBounds | null {
        if (!this.latRange || this.latRange.length !== 2 ||
            !this.lngRange || this.lngRange.length !== 2) return null;

        return new LngLatBounds([this.lngRange[0], this.latRange[0]], [this.lngRange[1], this.latRange[1]]);
    }

    /**
     * Sets or clears the map's geographical constraints.
     * @param {LngLatBounds} bounds A {@link LngLatBounds} object describing the new geographic boundaries of the map.
     */
    setMaxBounds(bounds?: LngLatBounds) {
        if (bounds) {
            this.lngRange = [bounds.getWest(), bounds.getEast()];
            this.latRange = [bounds.getSouth(), bounds.getNorth()];
            this._constrain();
        } else {
            this.lngRange = null;
            this.latRange = [-this.maxValidLatitude, this.maxValidLatitude];
        }
    }

    /**
     * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
     * @param {UnwrappedTileID} unwrappedTileID;
     * @private
     */
    calculatePosMatrix(unwrappedTileID: UnwrappedTileID, aligned: boolean = false): Float32Array {
        const posMatrixKey = unwrappedTileID.key;
        const cache = aligned ? this._alignedPosMatrixCache : this._posMatrixCache;
        if (cache[posMatrixKey]) {
            return cache[posMatrixKey];
        }

        const canonical = unwrappedTileID.canonical;
        const scale = this.worldSize / this.zoomScale(canonical.z);
        const unwrappedX = canonical.x + Math.pow(2, canonical.z) * unwrappedTileID.wrap;

        const posMatrix = mat4.identity(new Float64Array(16));
        mat4.translate(posMatrix, posMatrix, [unwrappedX * scale, canonical.y * scale, 0]);
        mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1]);
        mat4.multiply(posMatrix, aligned ? this.alignedProjMatrix : this.projMatrix, posMatrix);

        cache[posMatrixKey] = new Float32Array(posMatrix);
        return cache[posMatrixKey];
    }

    customLayerMatrix(): Array<number> {
        return this.mercatorMatrix.slice();
    }

    _constrain() {
        if (!this.center || !this.width || !this.height || this._constraining) return;

        this._constraining = true;

        let minY = -90;
        let maxY = 90;
        let minX = -180;
        let maxX = 180;
        let sy, sx, x2, y2;
        const size = this.size,
            unmodified = this._unmodified;

        if (this.latRange) {
            const latRange = this.latRange;
            minY = mercatorYfromLat(latRange[1]) * this.worldSize;
            maxY = mercatorYfromLat(latRange[0]) * this.worldSize;
            sy = maxY - minY < size.y ? size.y / (maxY - minY) : 0;
        }

        if (this.lngRange) {
            const lngRange = this.lngRange;
            minX = mercatorXfromLng(lngRange[0]) * this.worldSize;
            maxX = mercatorXfromLng(lngRange[1]) * this.worldSize;
            sx = maxX - minX < size.x ? size.x / (maxX - minX) : 0;
        }

        const point = this.point;

        // how much the map should scale to fit the screen into given latitude/longitude ranges
        const s = Math.max(sx || 0, sy || 0);

        if (s) {
            this.center = this.unproject(new Point(
                sx ? (maxX + minX) / 2 : point.x,
                sy ? (maxY + minY) / 2 : point.y));
            this.zoom += this.scaleZoom(s);
            this._unmodified = unmodified;
            this._constraining = false;
            return;
        }

        if (this.latRange) {
            const y = point.y,
                h2 = size.y / 2;

            if (y - h2 < minY) y2 = minY + h2;
            if (y + h2 > maxY) y2 = maxY - h2;
        }

        if (this.lngRange) {
            const x = point.x,
                w2 = size.x / 2;

            if (x - w2 < minX) x2 = minX + w2;
            if (x + w2 > maxX) x2 = maxX - w2;
        }

        // pan the map if the screen goes off the range
        if (x2 !== undefined || y2 !== undefined) {
            this.center = this.unproject(new Point(
                x2 !== undefined ? x2 : point.x,
                y2 !== undefined ? y2 : point.y));
        }

        this._unmodified = unmodified;
        this._constraining = false;
    }

    _calcMatrices() {
        if (!this.height) return;

        const halfFov = this._fov / 2;
        const offset = this.centerOffset;
        this.cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this.height;

        // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
        // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
        // 1 Z unit is equivalent to 1 horizontal px at the center of the map
        // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
        const groundAngle = Math.PI / 2 + this._pitch;
        const fovAboveCenter = this._fov * (0.5 + offset.y / this.height);
        const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * this.cameraToCenterDistance / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));
        const point = this.point;
        const x = point.x, y = point.y;

        // Calculate z distance of the farthest fragment that should be rendered.
        const furthestDistance = Math.cos(Math.PI / 2 - this._pitch) * topHalfSurfaceDistance + this.cameraToCenterDistance;
        // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
        const farZ = furthestDistance * 1.01;

        // The larger the value of nearZ is
        // - the more depth precision is available for features (good)
        // - clipping starts appearing sooner when the camera is close to 3d features (bad)
        //
        // Smaller values worked well for mapbox-gl-js but deckgl was encountering precision issues
        // when rendering it's layers using custom layers. This value was experimentally chosen and
        // seems to solve z-fighting issues in deckgl while not clipping buildings too close to the camera.
        const nearZ = this.height / 50;

        // matrix for conversion from location to GL coordinates (-1 .. 1)
        let m = new Float64Array(16);
        mat4.perspective(m, this._fov, this.width / this.height, nearZ, farZ);

        //Apply center of perspective offset
        m[8] = -offset.x * 2 / this.width;
        m[9] = offset.y * 2 / this.height;

        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [0, 0, -this.cameraToCenterDistance]);
        mat4.rotateX(m, m, this._pitch);
        mat4.rotateZ(m, m, this.angle);
        mat4.translate(m, m, [-x, -y, 0]);

        // The mercatorMatrix can be used to transform points from mercator coordinates
        // ([0, 0] nw, [1, 1] se) to GL coordinates.
        this.mercatorMatrix = mat4.scale([], m, [this.worldSize, this.worldSize, this.worldSize]);

        // scale vertically to meters per pixel (inverse of ground resolution):
        mat4.scale(m, m, [1, 1, mercatorZfromAltitude(1, this.center.lat) * this.worldSize, 1]);

        this.projMatrix = m;
        this.invProjMatrix = mat4.invert([], this.projMatrix);

        // Make a second projection matrix that is aligned to a pixel grid for rendering raster tiles.
        // We're rounding the (floating point) x/y values to achieve to avoid rendering raster images to fractional
        // coordinates. Additionally, we adjust by half a pixel in either direction in case that viewport dimension
        // is an odd integer to preserve rendering to the pixel grid. We're rotating this shift based on the angle
        // of the transformation so that 0°, 90°, 180°, and 270° rasters are crisp, and adjust the shift so that
        // it is always <= 0.5 pixels.
        const xShift = (this.width % 2) / 2, yShift = (this.height % 2) / 2,
            angleCos = Math.cos(this.angle), angleSin = Math.sin(this.angle),
            dx = x - Math.round(x) + angleCos * xShift + angleSin * yShift,
            dy = y - Math.round(y) + angleCos * yShift + angleSin * xShift;
        const alignedM = new Float64Array(m);
        mat4.translate(alignedM, alignedM, [ dx > 0.5 ? dx - 1 : dx, dy > 0.5 ? dy - 1 : dy, 0 ]);
        this.alignedProjMatrix = alignedM;

        m = mat4.create();
        mat4.scale(m, m, [this.width / 2, -this.height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        this.labelPlaneMatrix = m;

        m = mat4.create();
        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [-1, -1, 0]);
        mat4.scale(m, m, [2 / this.width, 2 / this.height, 1]);
        this.glCoordMatrix = m;

        // matrix for conversion from location to screen coordinates
        this.pixelMatrix = mat4.multiply(new Float64Array(16), this.labelPlaneMatrix, this.projMatrix);

        // inverse matrix for conversion from screen coordinaes to location
        m = mat4.invert(new Float64Array(16), this.pixelMatrix);
        if (!m) throw new Error("failed to invert matrix");
        this.pixelMatrixInverse = m;

        this._posMatrixCache = {};
        this._alignedPosMatrixCache = {};
    }

    maxPitchScaleFactor() {
        // calcMatrices hasn't run yet
        if (!this.pixelMatrixInverse) return 1;

        const coord = this.pointCoordinate(new Point(0, 0));
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, 0, 1];
        const topPoint = vec4.transformMat4(p, p, this.pixelMatrix);
        return topPoint[3] / this.cameraToCenterDistance;
    }

    /*
     * The camera looks at the map from a 3D (lng, lat, altitude) location. Let's use `cameraLocation`
     * as the name for the location under the camera and on the surface of the earth (lng, lat, 0).
     * `cameraPoint` is the projected position of the `cameraLocation`.
     *
     * This point is useful to us because only fill-extrusions that are between `cameraPoint` and
     * the query point on the surface of the earth can extend and intersect the query.
     *
     * When the map is not pitched the `cameraPoint` is equivalent to the center of the map because
     * the camera is right above the center of the map.
     */
    getCameraPoint() {
        const pitch = this._pitch;
        const yOffset = Math.tan(pitch) * (this.cameraToCenterDistance || 1);
        return this.centerPoint.add(new Point(0, yOffset));
    }

    /*
     * When the map is pitched, some of the 3D features that intersect a query will not intersect
     * the query at the surface of the earth. Instead the feature may be closer and only intersect
     * the query because it extrudes into the air.
     *
     * This returns a geometry that includes all of the original query as well as all possible ares of the
     * screen where the *base* of a visible extrusion could be.
     *  - For point queries, the line from the query point to the "camera point"
     *  - For other geometries, the envelope of the query geometry and the "camera point"
     */
    getCameraQueryGeometry(queryGeometry: Array<Point>): Array<Point> {
        const c = this.getCameraPoint();

        if (queryGeometry.length === 1) {
            return [queryGeometry[0], c];
        } else {
            let minX = c.x;
            let minY = c.y;
            let maxX = c.x;
            let maxY = c.y;
            for (const p of queryGeometry) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
            return [
                new Point(minX, minY),
                new Point(maxX, minY),
                new Point(maxX, maxY),
                new Point(minX, maxY),
                new Point(minX, minY)
            ];
        }
    }
}

export default Transform;
