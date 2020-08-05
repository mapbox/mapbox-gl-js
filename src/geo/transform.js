// @flow

import LngLat from './lng_lat';
import LngLatBounds from './lng_lat_bounds';
import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from './mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {wrap, clamp, radToDeg, degToRad} from '../util/util';
import {number as interpolate} from '../style-spec/util/interpolate';
import EXTENT from '../data/extent';
import {vec4, mat4, mat2, vec2, vec3, quat} from 'gl-matrix';
import {Aabb, Frustum, Ray} from '../util/primitives.js';
import EdgeInsets from './edge_insets';
import {FreeCamera, FreeCameraOptions, orientationFromFrame} from '../ui/free_camera';
import assert from 'assert';

import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../source/tile_id';
import type {Elevation} from '../terrain/elevation';
import type {PaddingOptions} from './edge_insets';

const NUM_WORLD_COPIES = 3;

type RayIntersectionResult = { p0: vec4, p1: vec4, t: number };

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
    skyboxMatrix: Float32Array;
    glCoordMatrix: Float32Array;
    labelPlaneMatrix: Float32Array;
    freezeTileCoverage: boolean;
    constantCameraHeight: boolean;
    _elevation: ?Elevation;
    _fov: number;
    _pitch: number;
    _zoom: number;
    _cameraZoom: ?number;
    _unmodified: boolean;
    _renderWorldCopies: boolean;
    _minZoom: number;
    _maxZoom: number;
    _minPitch: number;
    _maxPitch: number;
    _center: LngLat;
    _edgeInsets: EdgeInsets;
    _constraining: boolean;
    _posMatrixCache: {[_: number]: Float32Array};
    _alignedPosMatrixCache: {[_: number]: Float32Array};
    _camera: FreeCamera;
    _centerAltitude: number;

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
        this._camera = new FreeCamera();
        this._centerAltitude = 0;
        this.constantCameraHeight = true;
    }

    clone(): Transform {
        const clone = new Transform(this._minZoom, this._maxZoom, this._minPitch, this.maxPitch, this._renderWorldCopies);
        clone._elevation = this._elevation;
        clone._centerAltitude = this._centerAltitude;
        clone.tileSize = this.tileSize;
        clone.latRange = this.latRange;
        clone.width = this.width;
        clone.height = this.height;
        clone.constantCameraHeight = this.constantCameraHeight;
        clone._center = this._center;
        clone._setZoom(this.zoom);
        clone._cameraZoom = this._cameraZoom;
        clone.angle = this.angle;
        clone._fov = this._fov;
        clone._pitch = this._pitch;
        clone._unmodified = this._unmodified;
        clone._edgeInsets = this._edgeInsets.clone();
        clone._camera = this._camera.clone();
        clone._calcMatrices();
        clone.freezeTileCoverage = this.freezeTileCoverage;
        return clone;
    }

    get elevation(): ?Elevation { return this._elevation; }
    set elevation(elevation: ?Elevation) {
        if (this._elevation === elevation) return;
        this._elevation = elevation;
        if (!elevation) {
            this._cameraZoom = null;
            this._centerAltitude = 0;
        }
        this._calcMatrices();
    }
    updateElevation() { // On render, no need for higher granularity on update reasons.
        this._calcMatrices();
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
        this._setZoom(z);
        this._computeCameraZoom();
        this._constrain();
        this._calcMatrices();
    }
    _setZoom(z: number) {
        this._zoom = z;
        this.scale = this.zoomScale(z);
        this.tileZoom = Math.floor(z);
        this.zoomFraction = z - this.tileZoom;
    }

    _computeCameraZoom() {
        if (!this._elevation)
            return;

        // Camera zoom describes the distance of the camera to the sea level (altitude). It is used only for manipulating the camera location.
        // The standard zoom (this._zoom) defines the camera distance to the terrain (height). Its behavior and conceptual meaning in determining
        // which tiles to stream is same with or without the terrain.
        const elevationAtCenter = this._elevation.getAtPoint(MercatorCoordinate.fromLngLat(this.center), -1);

        if (elevationAtCenter === -1) {
            // Elevation data not loaded yet
            this._cameraZoom = null;
            return;
        }

        const height = this.cameraToCenterDistance / this.worldSize;
        const terrainElevation = mercatorZfromAltitude(elevationAtCenter, this.center.lat);

        this._cameraZoom = this._zoomFromMercatorZ(terrainElevation + height);
        this._centerAltitude = elevationAtCenter;
    }

    get center(): LngLat { return this._center; }
    set center(center: LngLat) {
        if (center.lat === this._center.lat && center.lng === this._center.lng) return;
        this._unmodified = false;
        this._center = center;
        if (!this.constantCameraHeight) {
            this._updateZoomFromElevation();
        }
        this._constrain();
        this._calcMatrices();
    }

    _updateZoomFromElevation() {
        if (!this._cameraZoom || !this._elevation)
            return;

        // Compute zoom level from the height of the camera relative to the terrain
        const cameraZoom: number = this._cameraZoom;
        const elevationAtCenter = this._elevation.getAtPoint(MercatorCoordinate.fromLngLat(this.center));
        const mercatorElevation = mercatorZfromAltitude(elevationAtCenter, this.center.lat);
        const altitude  = this._mercatorZfromZoom(cameraZoom);
        const minHeight = this._mercatorZfromZoom(this._maxZoom);
        const height = Math.max(altitude - mercatorElevation, minHeight);

        this._setZoom(this._zoomFromMercatorZ(height));
    }

    get padding(): PaddingOptions { return this._edgeInsets.toJSON(); }
    set padding(padding: PaddingOptions) {
        if (this._edgeInsets.equals(padding)) return;
        this._unmodified = false;
        //Update edge-insets inplace
        this._edgeInsets.interpolate(this._edgeInsets, padding, 1);
        this._calcMatrices();
    }

    setFreeCameraOptions(options: FreeCameraOptions) {
        if (!this.height)
            return;

        if (!options.position && !options.orientation)
            return;

        // Camera state must be up-to-date before accessing its getters
        this._updateCameraState();

        let changed = false;
        if (options.orientation && !quat.exactEquals(options.orientation, this._camera.orientation)) {
            changed = this._setCameraOrientation(options.orientation);
        }

        if (options.position) {
            const newPosition = [options.position.x, options.position.y, options.position.z];
            if (!vec3.exactEquals(newPosition, this._camera.position)) {
                this._setCameraPosition(newPosition);
                changed = true;
            }
        }

        if (changed) {
            this._updateStateFromCamera();
            this._calcMatrices();
        }
    }

    getFreeCameraOptions(): FreeCameraOptions {
        this._updateCameraState();
        const pos = this._camera.position;
        const options = new FreeCameraOptions();
        options.position = new MercatorCoordinate(pos[0], pos[1], pos[2]);
        options.orientation = this._camera.orientation;

        return options;
    }

    _setCameraOrientation(orientation: quat): boolean {
        // zero-length quaternions are not valid
        if (!quat.length(orientation))
            return false;

        quat.normalize(orientation, orientation);

        // The new orientation must be sanitized by making sure it can be represented
        // with a pitch and bearing. Roll-component must be removed and the camera can't be upside down
        const forward = vec3.transformQuat([], [0, 0, -1], orientation);
        const up = vec3.transformQuat([], [0, -1, 0], orientation);

        if (up[2] < 0.0)
            return false;

        const updatedOrientation = orientationFromFrame(forward, up);
        if (!updatedOrientation)
            return false;

        this._camera.orientation = updatedOrientation;
        return true;
    }

    _setCameraPosition(position: vec3) {
        // Altitude must be clamped to respect min and max zoom
        const minWorldSize = this.zoomScale(this.minZoom) * this.tileSize;
        const maxWorldSize = this.zoomScale(this.maxZoom) * this.tileSize;
        const distToCenter = this.cameraToCenterDistance;

        position[2] = clamp(position[2], distToCenter / maxWorldSize, distToCenter / minWorldSize);
        this._camera.position = position;
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
     * Returns the vertical half-fov, accounting for padding, in radians.
     *
     * @readonly
     * @type {number}
     * @private
     */
    get fovAboveCenter(): number {
        return this._fov * (0.5 + this.centerOffset.y / this.height);
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
            renderWorldCopies?: boolean,
            useElevationData?: boolean
        }
    ): Array<OverscaledTileID> {
        let z = this.coveringZoomLevel(options);
        const actualZ = z;

        const useElevationData = !!options.useElevationData;

        if (options.minzoom !== undefined && z < options.minzoom) return [];
        if (options.maxzoom !== undefined && z > options.maxzoom) z = options.maxzoom;

        const centerCoord = MercatorCoordinate.fromLngLat(this.center);
        const numTiles = 1 << z;
        const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
        const cameraFrustum = Frustum.fromInvProjectionMatrix(this.invProjMatrix, this.worldSize, z);
        const cameraCoord = this.pointCoordinate(this.getCameraPoint());
        const meterToTile = numTiles * mercatorZfromAltitude(1, this.center.lat);
        const cameraAltitude = this._camera.position[2] / mercatorZfromAltitude(1, this.center.lat);
        const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, cameraAltitude];
        // Let's consider an example for !roundZoom: e.g. tileZoom 16 is used from zoom 16 all the way to zoom 16.99.
        // This would mean that the minimal distance to split would be based on distance from camera to center of 16.99 zoom.
        // The same is already incorporated in logic behind roundZoom for raster (so there is no adjustment needed in following line).
        // 0.02 added to compensate for precision errors, see "coveringTiles for terrain" test in transform.test.js.
        const zoomSplitDistance = this.cameraToCenterDistance / options.tileSize * (options.roundZoom ? 1 : 0.502);

        // No change of LOD behavior for pitch lower than 60 and when there is no top padding: return only tile ids from the requested zoom level
        let minZoom = options.minzoom || 0;
        // Use 0.1 as an epsilon to avoid for explicit == 0.0 floating point checks
        if (this.pitch <= 60.0 && this._edgeInsets.top < 0.1 && !this._elevation)
            minZoom = z;

        const maxRange = this.elevation ? this.elevation.exaggeration() * 10000 : 0;
        const newRootTile = (wrap: number): any => {
            const max = maxRange;
            const min = -maxRange;
            return {
                // With elevation, this._elevation (to do) provides z coordinate values. For 2D:
                // All tiles are on zero elevation plane => z difference is zero
                aabb: new Aabb([wrap * numTiles, 0, min], [(wrap + 1) * numTiles, numTiles, max]),
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

        const samples: Array<vec3> = [[0, 0, 0], [0, EXTENT - 1, 0], [EXTENT / 2 - 1, EXTENT / 2 - 1, 0], [EXTENT - 1, 0, 0], [EXTENT - 1, EXTENT - 1, 0]];
        const getAABBFromElevation = (aabb, tileID) => {
            // Extreme ruggedness > 900m for 1km tile is rare: https://download.osgeo.org/qgis/doc/reference-docs/Terrain_Ruggedness_Index.pdf
            // We could use e.g. const maxRuggedness = 0.1 / meterToTile as additional buffer.
            // For now, sampling tile corners and center with no additional buffer: the idea is to
            // identify cases and amount of maxRuggedness buffer needed in follow up patches.
            assert(this._elevation); // Checked to silence flow.
            if (this._elevation && this._elevation.getForTilePoints(tileID, samples)) {
                aabb.min[2] = aabb.max[2] = samples[0][2];
                for (let i = 1; i < samples.length; i++) {
                    const val = samples[i];
                    aabb.min[2] = Math.min(val[2], aabb.min[2]);
                    aabb.max[2] = Math.max(val[2], aabb.max[2]);
                }
                aabb.center[2] = interpolate(aabb.min[2], aabb.max[2], 0.5);
            }
        };
        const square = a => a * a;
        const cameraHeightSqr = square((cameraAltitude - this._centerAltitude) * meterToTile); // in tile coordinates.

        // Scale distance to split for acute angles.
        // dzSqr: z component of camera to tile distance, square.
        // dSqr: 3D distance of camera to tile, square.
        const distToSplitScale = (dzSqr, dSqr) => {
            // When the angle between camera to tile ray and tile plane is smaller
            // than acuteAngleThreshold, scale the distance to split. Scaling is adaptive: smaller
            // the angle, the scale gets lower value. Although it seems early to start at 45,
            // it is not: scaling kicks in around 60 degrees pitch.
            const acuteAngleThresholdSin = 0.707; // Math.sin(45)
            const stretchTile = 1.1;
            // Distances longer than 'dz / acuteAngleThresholdSin' gets scaled
            // following geometric series sum: every next dz length in distance can be
            // 'stretchTile times' longer. It is further, the angle is sharper. Total,
            // adjusted, distance would then be:
            // = dz / acuteAngleThresholdSin + (dz * stretchTile + dz * stretchTile ^ 2 + ... + dz * stretchTile ^ k),
            // where k = (d - dz / acuteAngleThresholdSin) / dz = d / dz - 1 / acuteAngleThresholdSin;
            // = dz / acuteAngleThresholdSin + dz * ((stretchTile ^ (k + 1) - 1) / (stretchTile - 1) - 1)
            // or put differently, given that k is based on d and dz, tile on distance d could be used on distance scaled by:
            // 1 / acuteAngleThresholdSin + (stretchTile ^ (k + 1) - 1) / (stretchTile - 1) - 1
            if (dSqr * square(acuteAngleThresholdSin) < dzSqr) return 1.0; // Early return, no scale.
            const r = Math.sqrt(dSqr / dzSqr);
            const k =  r - 1 / acuteAngleThresholdSin;
            return r / (1 / acuteAngleThresholdSin + (Math.pow(stretchTile, k + 1) - 1) / (stretchTile - 1) - 1);
        };

        if (this._renderWorldCopies) {
            // Render copy of the globe thrice on both sides
            for (let i = 1; i <= NUM_WORLD_COPIES; i++) {
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

            // Have we reached the target depth?
            if (it.zoom === maxZoom) {
                result.push({
                    tileID: it.tileID ? it.tileID : new OverscaledTileID(overscaledZ, it.wrap, it.zoom, x, y),
                    distanceSq: vec2.sqrLen([centerPoint[0] - 0.5 - x - (it.wrap << z), centerPoint[1] - 0.5 - y])
                });
                continue;
            }

            const dx = it.aabb.distanceX(cameraPoint);
            const dy = it.aabb.distanceY(cameraPoint);
            const dzSqr = useElevationData ? square(it.aabb.distanceZ(cameraPoint) * meterToTile) : cameraHeightSqr;
            const distanceSqr = dx * dx + dy * dy + dzSqr;

            const distToSplit = (1 << maxZoom - it.zoom) * zoomSplitDistance;
            const distToSplitSqr = square(distToSplit * distToSplitScale(Math.max(dzSqr, cameraHeightSqr), distanceSqr));
            // Is the tile too far away to be any split further?
            if (distanceSqr > distToSplitSqr && it.zoom >= minZoom) {
                result.push({
                    tileID: it.tileID ? it.tileID : new OverscaledTileID(it.zoom, it.wrap, it.zoom, x, y),
                    distanceSq: vec2.sqrLen([centerPoint[0] - ((0.5 + x + (it.wrap << it.zoom)) << (z - it.zoom)), centerPoint[1] - 0.5 - y])
                });
                continue;
            }

            for (let i = 0; i < 4; i++) {
                const childX = (x << 1) + (i % 2);
                const childY = (y << 1) + (i >> 1);

                const aabb = it.aabb.quadrant(i);
                let tileID = null;
                if (useElevationData && it.zoom > maxZoom - 6) {
                    // Using elevation data for tiles helps clipping out tiles that are not visible and
                    // precise distance calculation. This is an optimization - tiles with it.zoom <= maxZoom - 6 are always
                    // considered slightly closer: aabb.distanceZ() there evaluates to 0 as min/max[3] = -/+ maxRange.
                    tileID = new OverscaledTileID(it.zoom + 1 === maxZoom ? overscaledZ : it.zoom + 1, it.wrap, it.zoom + 1, childX, childY);
                    getAABBFromElevation(aabb, tileID);
                }
                stack.push({aabb, zoom: it.zoom + 1, x: childX, y: childY, wrap: it.wrap, fullyVisible, tileID});
            }
        }
        const cover = result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
        // Relax the assertion on terrain, on high zoom we use distance to center of tile
        // while camera might be closer to selected center of map.
        assert(!cover.length || this.elevation || cover[0].overscaledZ === overscaledZ);
        return cover;
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

    setLocation(location: MercatorCoordinate) {
        this.center = this.coordinateLocation(location);
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

    /**
     * Casts a ray from a point on screen and returns the Ray,
     * and the extent along it, at which it intersects the map plane.
     *
     * @param {Point} p viewport pixel co-ordinates
     * @returns {{ p0: vec4, p1: vec4, t: number }} p0,p1 are two points on the ray
     * t is the fractional extent along the ray at which the ray intersects the map plane
     * @private
     */
    pointRayIntersection(p: Point): RayIntersectionResult {
        const targetZ = this._centerAltitude;
        // since we don't know the correct projected z value for the point,
        // unproject two points to get a line and then find the point on that
        // line with z=0

        const p0 = [p.x, p.y, 0, 1];
        const p1 = [p.x, p.y, 1, 1];

        vec4.transformMat4(p0, p0, this.pixelMatrixInverse);
        vec4.transformMat4(p1, p1, this.pixelMatrixInverse);

        const w0 = p0[3];
        const w1 = p1[3];
        vec4.scale(p0, p0, 1 / w0);
        vec4.scale(p1, p1, 1 / w1);

        const z0 = p0[2];
        const z1 = p1[2];

        const t = z0 === z1 ? 0 : (targetZ - z0) / (z1 - z0);

        return {p0, p1, t};
    }

    screenPointToMercatorRay(p: Point): Ray {
        const p0 = [p.x, p.y, 0, 1];
        const p1 = [p.x, p.y, 1, 1];

        vec4.transformMat4(p0, p0, this.pixelMatrixInverse);
        vec4.transformMat4(p1, p1, this.pixelMatrixInverse);

        vec4.scale(p0, p0, 1 / p0[3]);
        vec4.scale(p1, p1, 1 / p1[3]);

        // Convert altitude from meters to pixels
        p0[2] = mercatorZfromAltitude(p0[2], this._center.lat) * this.worldSize;
        p1[2] = mercatorZfromAltitude(p1[2], this._center.lat) * this.worldSize;

        vec4.scale(p0, p0, 1 / this.worldSize);
        vec4.scale(p1, p1, 1 / this.worldSize);

        return new Ray([p0[0], p0[1], p0[2]], vec3.normalize([], vec3.sub([], p1, p0)));
    }

    /**
     *  Helper method to convert the ray intersectsection with the map plane to MercatorCoordinate
     *
     * @param {RayIntersectionResult} rayIntersection
     * @returns {MercatorCoordinate}
     * @private
     */
    rayIntersectionCoordinate(rayIntersection: RayIntersectionResult): MercatorCoordinate {
        const {p0, p1, t} = rayIntersection;

        return new MercatorCoordinate(
            interpolate(p0[0], p1[0], t) / this.worldSize,
            interpolate(p0[1], p1[1], t) / this.worldSize);
    }

    pointCoordinate(p: Point) {
        return this.rayIntersectionCoordinate(this.pointRayIntersection(p));
    }

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param {Coordinate} coord
     * @returns {Point} screen point
     * @private
     */
    coordinatePoint(coord: MercatorCoordinate) {
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, this._centerAltitude + coord.toAltitude(), 1];
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

    recenterOnTerrain() {
        if (!this._elevation)
            return;

        const elevation: Elevation = this._elevation;
        this._updateCameraState();

        // Cast a ray towards the sea level and find the intersection point with the terrain.
        const start = this._camera.mercatorPosition;
        const dir = this._camera.forward();

        if (start.z <= 0 || dir[2] >= 0)
            return;

        const distance = start.z / -dir[2];
        const end = new MercatorCoordinate(start.x + dir[0] * distance, start.y + dir[1] * distance, start.z + dir[2] * distance);
        const newCenter = elevation.raycast(start, end);

        if (newCenter) {
            const pos = this._camera.mercatorPosition;
            const camToNew = [newCenter.x - pos.x, newCenter.y - pos.y, newCenter.z - pos.z];
            const maxAltitude = mercatorZfromAltitude(newCenter.toAltitude(), this.center.lat) + vec3.length(camToNew);

            // Camera zoom has to be updated as the orbit distance might have changed
            this._cameraZoom = this._zoomFromMercatorZ(maxAltitude);
            this._centerAltitude = newCenter.toAltitude();
            this.center = newCenter.toLngLat();
        }
    }

    _constrainCameraAltitude() {
        if (!this._elevation)
            return;

        const elevationAtCamera = this._elevation.getAtPoint(this._camera.mercatorPosition);
        this._updateCameraState();

        // Use maxZoom to determine minimum height for the camera over the terrain
        const minHeight = this.cameraToCenterDistance / this._worldSizeFromZoom(this._maxZoom) * Math.cos(degToRad(this._maxPitch));
        const terrainElevation = mercatorZfromAltitude(elevationAtCamera, this._center.lat);
        const cameraHeight = this._camera.position[2] - terrainElevation;

        if (cameraHeight < minHeight) {
            const center = MercatorCoordinate.fromLngLat(this._center, this._centerAltitude);
            const cameraPos = this._camera.mercatorPosition;
            const cameraToCenter = [center.x - cameraPos.x, center.y - cameraPos.y, center.z - cameraPos.z];
            const prevDistToCamera = vec3.length(cameraToCenter);

            // Adjust the camera vector so that the camera is placed above the terrain.
            // Distance between the camera and the center point is kept constant.
            cameraToCenter[2] -= minHeight - cameraHeight;

            const newDistToCamera = vec3.length(cameraToCenter);
            if (newDistToCamera === 0)
                return;

            vec3.scale(cameraToCenter, cameraToCenter, prevDistToCamera / newDistToCamera);
            this._camera.position = [center.x - cameraToCenter[0], center.y - cameraToCenter[1], center.z - cameraToCenter[2]];
            this._camera.orientation = orientationFromFrame(cameraToCenter, this._camera.up());
            this._updateStateFromCamera();
        }
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

        this._constrainCameraAltitude();

        this._unmodified = unmodified;
        this._constraining = false;
    }

    _calcMatrices() {
        if (!this.height) return;

        const halfFov = this._fov / 2;
        const offset = this.centerOffset;
        this.cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this.height;
        const pixelsPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;

        if (this._elevation) {
            if (this.constantCameraHeight || !this._cameraZoom) {
                this._computeCameraZoom();
            }

            if (!this.constantCameraHeight)
                this._updateZoomFromElevation();
        }

        this._updateCameraState();

        // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
        // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
        // 1 Z unit is equivalent to 1 horizontal px at the center of the map
        // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
        const groundAngle = Math.PI / 2 + this._pitch;
        const fovAboveCenter = this.fovAboveCenter;

        const cameraToSeaLevelDistance = this._camera.position[2] * this.worldSize / Math.cos(this._pitch);
        const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * cameraToSeaLevelDistance / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));
        const point = this.point;
        const x = point.x, y = point.y;

        // Calculate z distance of the farthest fragment that should be rendered.
        const furthestDistance = Math.cos(Math.PI / 2 - this._pitch) * topHalfSurfaceDistance + cameraToSeaLevelDistance;
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

        const worldToCamera = this._camera.getWorldToCamera(this.worldSize, pixelsPerMeter);
        const cameraToClip = this._camera.getCameraToClipPerspective(this._fov, this.width / this.height, nearZ, farZ);

        // Apply center of perspective offset
        cameraToClip[8] = -offset.x * 2 / this.width;
        cameraToClip[9] = offset.y * 2 / this.height;

        let m = mat4.mul([], cameraToClip, worldToCamera);

        // The mercatorMatrix can be used to transform points from mercator coordinates
        // ([0, 0] nw, [1, 1] se) to GL coordinates.
        this.mercatorMatrix = mat4.scale([], m, [this.worldSize, this.worldSize, this.worldSize / pixelsPerMeter]);

        this.projMatrix = m;
        // For tile cover calculation, use inverted of base (non elevated) matrix
        // as tile elevations are in tile coordinates and relative to center elevation.
        this.invProjMatrix = mat4.invert(new Float64Array(16), this.projMatrix);

        const view = new Float32Array(16);
        mat4.identity(view);
        mat4.scale(view, view, [1, -1, 1]);
        mat4.rotateX(view, view, this._pitch);
        mat4.rotateZ(view, view, this.angle);

        const projection = mat4.perspective(new Float32Array(16), this._fov, this.width / this.height, nearZ, farZ);
        this.skyboxMatrix = mat4.multiply(view, projection, view);

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

        // inverse matrix for conversion from screen coordinates to location
        m = mat4.invert(new Float64Array(16), this.pixelMatrix);
        if (!m) throw new Error("failed to invert matrix");
        this.pixelMatrixInverse = m;

        this._posMatrixCache = {};
        this._alignedPosMatrixCache = {};
    }

    _updateCameraState() {
        if (!this.height) return;

        // Set camera orientation and move it to a proper distance from the map
        this._camera.setPitchBearing(this._pitch, this.angle);

        const dir = this._camera.forward();
        const distance = this.cameraToCenterDistance;
        const center = this.point;

        // Use camera zoom (if terrain is enabled) to maintain constant altitude to sea level
        const zoom = this._cameraZoom ? this._cameraZoom : this._zoom;
        const altitude = this.cameraToCenterDistance / this._worldSizeFromZoom(zoom);
        const height = altitude - mercatorZfromAltitude(this._centerAltitude, this.center.lat);

        // simplified version of: this._worldSizeFromZoom(this._zoomFromMercatorZ(height))
        const updatedWorldSize = this.cameraToCenterDistance / height;

        this._camera.position = [
            center.x / this.worldSize - (dir[0] * distance) / updatedWorldSize,
            center.y / this.worldSize - (dir[1] * distance) / updatedWorldSize,
            mercatorZfromAltitude(this._centerAltitude, this._center.lat) + (-dir[2] * distance) / updatedWorldSize
        ];
    }

    _updateStateFromCamera() {
        const position = this._camera.position;
        const dir = this._camera.forward();
        const {pitch, bearing} = this._camera.getPitchBearing();

        // Compute zoom from the distance between camera and terrain
        const centerAltitude = mercatorZfromAltitude(this._centerAltitude, this.center.lat);
        const height = (position[2] - centerAltitude) / Math.cos(pitch);
        const zoom = this._zoomFromMercatorZ(height);

        // Cast a ray towards the ground to find the center point
        vec3.scaleAndAdd(position, position, dir, -height * Math.cos(pitch) / dir[2]);

        this.pitch = radToDeg(pitch);
        this.bearing = radToDeg(-bearing);
        this._setZoom(clamp(zoom, this._minZoom, this._maxZoom));
        this.center = new MercatorCoordinate(position[0], position[1], position[2]).toLngLat();
    }

    _worldSizeFromZoom(zoom: number): number {
        return Math.pow(2.0, zoom) * this.tileSize;
    }

    _mercatorZfromZoom(zoom: number, pitch: ?number): number {
        const cosPitch = pitch ? Math.cos(pitch) : 1.0;
        return this.cameraToCenterDistance / this._worldSizeFromZoom(zoom) * cosPitch;
    }

    _zoomFromMercatorZ(z: number): number {
        return this.scaleZoom(this.cameraToCenterDistance / (z * this.tileSize));
    }

    maxPitchScaleFactor() {
        // calcMatrices hasn't run yet
        if (!this.pixelMatrixInverse) return 1;

        const coord = this.pointCoordinate(new Point(0, 0));
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, 0, 1];
        const topPoint = vec4.transformMat4(p, p, this.pixelMatrix);
        return topPoint[3] / this.cameraToCenterDistance;
    }

    //Checks the four corners of the frustum to see if they lie in the map's quad.
    isHorizonVisible(): boolean {
        // we consider the horizon as visible if the angle between
        // a the top plane of the frustum and the map plane is smaller than this threshold.
        const horizonAngleEpsilon = 2;
        if (this.pitch + radToDeg(this.fovAboveCenter) > (90 - horizonAngleEpsilon)) {
            return true;
        }

        const corners = [
            new Point(0, 0),
            new Point(this.width, 0),
            new Point(this.width, this.height),
            new Point(0, this.height)
        ];

        const minX = (this._renderWorldCopies) ? -NUM_WORLD_COPIES : 0;
        const maxX = (this._renderWorldCopies) ? 1 + NUM_WORLD_COPIES : 1;
        const minY = 0;
        const maxY = 1;

        for (const corner of corners) {
            const rayIntersection = this.pointRayIntersection(corner);
            if (rayIntersection.t < 0) {
                return true;
            }

            const coordinate = this.rayIntersectionCoordinate(rayIntersection);
            if (coordinate.x < minX || coordinate.y < minY ||
                coordinate.x > maxX || coordinate.y > maxY) {
                return true;
            }
        }

        return false;
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
