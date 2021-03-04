// @flow

import LngLat from './lng_lat.js';
import LngLatBounds from './lng_lat_bounds.js';
import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude, latFromMercatorY} from './mercator_coordinate.js';
import Point from '@mapbox/point-geometry';
import {wrap, clamp, radToDeg, degToRad} from '../util/util.js';
import {number as interpolate} from '../style-spec/util/interpolate.js';
import EXTENT from '../data/extent.js';
import {vec4, mat4, mat2, vec3, quat} from 'gl-matrix';
import {Aabb, Frustum, Ray} from '../util/primitives.js';
import EdgeInsets from './edge_insets.js';
import {FreeCamera, FreeCameraOptions, orientationFromFrame} from '../ui/free_camera.js';
import assert from 'assert';

import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import type {Elevation} from '../terrain/elevation.js';
import type {PaddingOptions} from './edge_insets.js';

const NUM_WORLD_COPIES = 3;
const DEFAULT_MIN_ZOOM = 0;

type RayIntersectionResult = { p0: vec4, p1: vec4, t: number};
type ElevationReference = "sea" | "ground";

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
    cameraElevationReference: ElevationReference;
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
    _horizonShift: number;

    constructor(minZoom: ?number, maxZoom: ?number, minPitch: ?number, maxPitch: ?number, renderWorldCopies: boolean | void) {
        this.tileSize = 512; // constant
        this.maxValidLatitude = 85.051129; // constant

        this._renderWorldCopies = renderWorldCopies === undefined ? true : renderWorldCopies;
        this._minZoom = minZoom || DEFAULT_MIN_ZOOM;
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
        this.cameraElevationReference = "ground";

        // Move the horizon closer to the center. 0 would not shift the horizon. 1 would put the horizon at the center.
        this._horizonShift = 0.1;
    }

    clone(): Transform {
        const clone = new Transform(this._minZoom, this._maxZoom, this._minPitch, this.maxPitch, this._renderWorldCopies);
        clone._elevation = this._elevation;
        clone._centerAltitude = this._centerAltitude;
        clone.tileSize = this.tileSize;
        clone.latRange = this.latRange;
        clone.width = this.width;
        clone.height = this.height;
        clone.cameraElevationReference = this.cameraElevationReference;
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
        } else {
            if (this._updateCenterElevation())
                this._updateCameraOnTerrain();
        }
        this._calcMatrices();
    }
    updateElevation(constrainCameraOverTerrain: boolean) { // On render, no need for higher granularity on update reasons.
        if (this._terrainEnabled() && this._cameraZoom == null) {
            if (this._updateCenterElevation())
                this._updateCameraOnTerrain();
        }
        if (constrainCameraOverTerrain) {
            this._constrainCameraAltitude();
        }
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
        if (this._terrainEnabled()) {
            this._updateCameraOnTerrain();
        }
        this._constrain();
        this._calcMatrices();
    }
    _setZoom(z: number) {
        this._zoom = z;
        this.scale = this.zoomScale(z);
        this.tileZoom = Math.floor(z);
        this.zoomFraction = z - this.tileZoom;
    }

    _updateCenterElevation(): boolean {
        if (!this._elevation)
            return false;

        // Camera zoom describes the distance of the camera to the sea level (altitude). It is used only for manipulating the camera location.
        // The standard zoom (this._zoom) defines the camera distance to the terrain (height). Its behavior and conceptual meaning in determining
        // which tiles to stream is same with or without the terrain.
        const elevationAtCenter = this._elevation.getAtPoint(MercatorCoordinate.fromLngLat(this.center), -1);

        if (elevationAtCenter === -1) {
            // Elevation data not loaded yet
            this._cameraZoom = null;
            return false;
        }

        this._centerAltitude = elevationAtCenter;
        return true;
    }

    // Places the camera above terrain so that the current zoom value is respected at the center.
    // In other words, camera height in relative to ground elevation remains constant.
    // Returns false if the elevation data is not available (yet) at the center point.
    _updateCameraOnTerrain() {
        const height = this.cameraToCenterDistance / this.worldSize;
        const terrainElevation = mercatorZfromAltitude(this._centerAltitude, this.center.lat);

        this._cameraZoom = this._zoomFromMercatorZ(terrainElevation + height);
    }

    get center(): LngLat { return this._center; }
    set center(center: LngLat) {
        if (center.lat === this._center.lat && center.lng === this._center.lng) return;

        this._unmodified = false;
        this._center = center;
        if (this._terrainEnabled()) {
            if (this.cameraElevationReference === "ground") {
                // Check that the elevation data is available at the new location.
                if (this._updateCenterElevation())
                    this._updateCameraOnTerrain();
                else
                    this._cameraZoom = null;
            } else {
                this._updateZoomFromElevation();
            }
        }
        this._constrain();
        this._calcMatrices();
    }

    _updateZoomFromElevation() {
        if (this._cameraZoom == null || !this._elevation)
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

    /**
     * Computes a zoom value relative to a map plane that goes through the provided mercator position.
     * @param {MercatorCoordinate} position A position defining the altitude of the the map plane.
     * @returns {number} The zoom value.
     */
    computeZoomRelativeTo(position: MercatorCoordinate): number {
        // Find map center position on the target plane by casting a ray from screen center towards the plane.
        // Direct distance to the target position is used if the target position is above camera position.
        const centerOnTargetAltitude = this.rayIntersectionCoordinate(this.pointRayIntersection(this.centerPoint, position.toAltitude()));

        let targetPosition: ?vec3;
        if (position.z < this._camera.position[2]) {
            targetPosition = [centerOnTargetAltitude.x, centerOnTargetAltitude.y, centerOnTargetAltitude.z];
        } else {
            targetPosition = [position.x, position.y, position.z];
        }

        const distToTarget = vec3.length(vec3.sub([], this._camera.position, targetPosition));
        return clamp(this._zoomFromMercatorZ(distToTarget), this._minZoom, this._maxZoom);
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
            this.recenterOnTerrain();
        }
    }

    getFreeCameraOptions(): FreeCameraOptions {
        this._updateCameraState();
        const pos = this._camera.position;
        const options = new FreeCameraOptions();
        options.position = new MercatorCoordinate(pos[0], pos[1], pos[2]);
        options.orientation = this._camera.orientation;
        options._elevation = this.elevation;
        options._renderWorldCopies = this._renderWorldCopies;

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
     * Returns true if the padding options are equal.
     *
     * @param {PaddingOptions} padding The padding options to compare.
     * @returns {boolean} True if the padding options are equal.
     * @memberof Transform
     */
    isPaddingEqual(padding: PaddingOptions): boolean {
        return this._edgeInsets.equals(padding);
    }

    /**
     * Helper method to update edge-insets inplace.
     *
     * @param {PaddingOptions} start The initial padding options.
     * @param {PaddingOptions} target The target padding options.
     * @param {number} t The interpolation variable.
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
        const minZoom = this.pitch <= 60.0 && this._edgeInsets.top <= this._edgeInsets.bottom && !this._elevation ? z : 0;

        const maxRange = this.elevation ? this.elevation.exaggeration() * 10000 : 0;
        const newRootTile = (wrap: number): any => {
            const max = maxRange;
            const min = -maxRange;
            return {
                // With elevation, this._elevation provides z coordinate values. For 2D:
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

        const getAABBFromElevation = (aabb, tileID) => {
            assert(this._elevation);
            if (!this._elevation) return;  // To silence flow.
            const minmax = this._elevation.getMinMaxForTile(tileID);
            if (minmax) {
                aabb.min[2] = minmax.min;
                aabb.max[2] = minmax.max;
                aabb.center[2] = (aabb.min[2] + aabb.max[2]) / 2;
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

            let shouldSplit = true;
            if (minZoom <= it.zoom && it.zoom < maxZoom) {
                const dx = it.aabb.distanceX(cameraPoint);
                const dy = it.aabb.distanceY(cameraPoint);
                let dzSqr = cameraHeightSqr;

                if (useElevationData) {
                    dzSqr = square(it.aabb.distanceZ(cameraPoint) * meterToTile);
                }

                const distanceSqr = dx * dx + dy * dy + dzSqr;
                const distToSplit = (1 << maxZoom - it.zoom) * zoomSplitDistance;
                const distToSplitSqr = square(distToSplit * distToSplitScale(Math.max(dzSqr, cameraHeightSqr), distanceSqr));

                shouldSplit = distanceSqr < distToSplitSqr;
            }

            // Have we reached the target depth or is the tile too far away to be any split further?
            if (it.zoom === maxZoom || !shouldSplit) {
                const tileZoom = it.zoom === maxZoom ? overscaledZ : it.zoom;
                if (!!options.minzoom && options.minzoom > tileZoom) {
                    // Not within source tile range.
                    continue;
                }

                const dx = centerPoint[0] - ((0.5 + x + (it.wrap << it.zoom)) * (1 << (z - it.zoom)));
                const dy = centerPoint[1] - 0.5 - y;
                const id = it.tileID ? it.tileID : new OverscaledTileID(tileZoom, it.wrap, it.zoom, x, y);

                result.push({tileID: id, distanceSq: dx * dx + dy * dy});
                continue;
            }

            for (let i = 0; i < 4; i++) {
                const childX = (x << 1) + (i % 2);
                const childY = (y << 1) + (i >> 1);

                const aabb = it.aabb.quadrant(i);
                let tileID = null;
                if (useElevationData && it.zoom > maxZoom - 6) {
                    // Using elevation data for tiles helps clipping out tiles that are not visible and
                    // precise distance calculation. it.zoom > maxZoom - 6 is an optimization as those before get subdivided
                    // or they are so far at horizon that it doesn't matter.
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
     * Given a location, return the screen point that corresponds to it. In 3D mode
     * (with terrain) this behaves the same as in 2D mode.
     * This method is coupled with {@see pointLocation} in 3D mode to model map manipulation
     * using flat plane approach to keep constant elevation above ground.
     * @param {LngLat} lnglat location
     * @returns {Point} screen point
     * @private
     */
    locationPoint(lnglat: LngLat) {
        return this._coordinatePoint(this.locationCoordinate(lnglat), false);
    }

    /**
     * Given a location, return the screen point that corresponds to it
     * In 3D mode (when terrain is enabled) elevation is sampled for the point before
     * projecting it. In 2D mode, behaves the same locationPoint.
     * @param {LngLat} lnglat location
     * @returns {Point} screen point
     * @private
     */
    locationPoint3D(lnglat: LngLat) {
        return this._coordinatePoint(this.locationCoordinate(lnglat), true);
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
     * Given a point on screen, return its lnglat
     * In 3D mode (map with terrain) returns location of terrain raycast point.
     * In 2D mode, behaves the same as {@see pointLocation}.
     * @param {Point} p screen point
     * @returns {LngLat} lnglat location
     * @private
     */
    pointLocation3D(p: Point) {
        return this.coordinateLocation(this.pointCoordinate3D(p));
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
     * @param {number} z optional altitude of the map plane
     * @returns {{ p0: vec4, p1: vec4, t: number }} p0,p1 are two points on the ray
     * t is the fractional extent along the ray at which the ray intersects the map plane
     * @private
     */
    pointRayIntersection(p: Point, z: ?number): RayIntersectionResult {
        const targetZ = (z !== undefined && z !== null) ? z : this._centerAltitude;
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
     *  Helper method to convert the ray intersection with the map plane to MercatorCoordinate
     *
     * @param {RayIntersectionResult} rayIntersection
     * @returns {MercatorCoordinate}
     * @private
     */
    rayIntersectionCoordinate(rayIntersection: RayIntersectionResult): MercatorCoordinate {
        const {p0, p1, t} = rayIntersection;

        const z0 = mercatorZfromAltitude(p0[2], this._center.lat);
        const z1 = mercatorZfromAltitude(p1[2], this._center.lat);

        return new MercatorCoordinate(
            interpolate(p0[0], p1[0], t) / this.worldSize,
            interpolate(p0[1], p1[1], t) / this.worldSize,
            interpolate(z0, z1, t));
    }

    /**
     * Given a point on screen, returns MercatorCoordinate.
     * @param {Point} p top left origin screen point, in pixels.
     * @private
     */
    pointCoordinate(p: Point): MercatorCoordinate {
        const horizonOffset = this.horizonLineFromTop(false);
        const clamped = new Point(p.x, Math.max(horizonOffset, p.y));

        return this.rayIntersectionCoordinate(this.pointRayIntersection(clamped));
    }

    /**
     * Given a point on screen, returns MercatorCoordinate.
     * In 3D mode, raycast to terrain. In 2D mode, behaves the same as {@see pointCoordinate}.
     * For p above terrain, don't return point behind camera but clamp p.y at the top of terrain.
     * @param {Point} p top left origin screen point, in pixels.
     * @private
     */
    pointCoordinate3D(p: Point): MercatorCoordinate {
        if (!this.elevation) return this.pointCoordinate(p);
        const elevation = this.elevation;
        let raycast = this.elevation.pointCoordinate(p);
        if (raycast) return new MercatorCoordinate(raycast[0], raycast[1], raycast[2]);
        let start = 0, end = this.horizonLineFromTop();
        if (p.y > end) return this.pointCoordinate(p); // holes between tiles below horizon line or below bottom.
        const samples = 10;
        const threshold = 0.02 * end;
        const r = p.clone();

        for (let i = 0; i < samples && end - start > threshold; i++) {
            r.y = interpolate(start, end, 0.66); // non uniform binary search favoring points closer to horizon.
            const rCast = elevation.pointCoordinate(r);
            if (rCast) {
                end = r.y;
                raycast = rCast;
            } else {
                start = r.y;
            }
        }
        return raycast ? new MercatorCoordinate(raycast[0], raycast[1], raycast[2]) : this.pointCoordinate(p);
    }

    /**
     * Returns true if a screenspace Point p, is above the horizon.
     *
     * @param {Point} p
     * @returns {boolean}
     * @private
     */
    isPointAboveHorizon(p: Point): boolean {
        if (!this.elevation) {
            const horizon = this.horizonLineFromTop();
            return p.y < horizon;
        } else {
            return !this.elevation.pointCoordinate(p);
        }
    }

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param {Coordinate} coord
     * @param {boolean} sampleTerrainIn3D in 3D mode (terrain enabled), sample elevation for the point.
     * If false, do the same as in 2D mode, assume flat camera elevation plane for all points.
     * @returns {Point} screen point
     * @private
     */
    _coordinatePoint(coord: MercatorCoordinate, sampleTerrainIn3D: boolean) {
        const elevation = sampleTerrainIn3D && this.elevation ? this.elevation.getAtPoint(coord, this._centerAltitude) : this._centerAltitude;
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, elevation + coord.toAltitude(), 1];
        vec4.transformMat4(p, p, this.pixelMatrix);
        return p[3] > 0 ?
            new Point(p[0] / p[3], p[1] / p[3]) :
            new Point(Number.MAX_VALUE, Number.MAX_VALUE);
    }

    /**
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     * @returns {LngLatBounds} Returns a {@link LngLatBounds} object describing the map's geographical bounds.
     */
    getBounds(): LngLatBounds {
        if (this._terrainEnabled()) return this._getBounds3D();
        return new LngLatBounds()
            .extend(this.pointLocation(new Point(this._edgeInsets.left, this._edgeInsets.top)))
            .extend(this.pointLocation(new Point(this.width - this._edgeInsets.right, this._edgeInsets.top)))
            .extend(this.pointLocation(new Point(this.width - this._edgeInsets.right, this.height - this._edgeInsets.bottom)))
            .extend(this.pointLocation(new Point(this._edgeInsets.left, this.height - this._edgeInsets.bottom)));
    }

    _getBounds3D(): LngLatBounds {
        assert(this.elevation);
        const elevation = ((this.elevation: any): Elevation);
        const minmax = elevation.visibleDemTiles.reduce((acc, t) => {
            if (t.dem) {
                const tree = t.dem.tree;
                acc.min = Math.min(acc.min, tree.minimums[0]);
                acc.max = Math.max(acc.max, tree.maximums[0]);
            }
            return acc;
        }, {min: Number.MAX_VALUE, max: 0});
        minmax.min *= elevation.exaggeration();
        minmax.max *= elevation.exaggeration();
        const top = this.horizonLineFromTop();
        return [
            new Point(0, top),
            new Point(this.width, top),
            new Point(this.width, this.height),
            new Point(0, this.height)
        ].reduce((acc, p) => {
            return acc
                .extend(this.coordinateLocation(this.rayIntersectionCoordinate(this.pointRayIntersection(p, minmax.min))))
                .extend(this.coordinateLocation(this.rayIntersectionCoordinate(this.pointRayIntersection(p, minmax.max))));
        }, new LngLatBounds());
    }

    /**
     * Returns position of horizon line from the top of the map in pixels. If horizon is not visible, returns 0.
     * @private
     */
    horizonLineFromTop(clampToTop: boolean = true): number {
        // h is height of space above map center to horizon.
        const h = this.height / 2 / Math.tan(this._fov / 2) / Math.tan(Math.max(this._pitch, 0.1)) + this.centerOffset.y;
        // incorporate 3% of the area above center to account for reduced precision.
        const horizonEpsilon = 0.03;
        const offset = this.height / 2 - h * (1 - horizonEpsilon);
        return clampToTop ? Math.max(0, offset) : offset;
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
        const start = this._camera.position;
        const dir = this._camera.forward();

        if (start.z <= 0 || dir[2] >= 0)
            return;

        // The raycast function expects z-component to be in meters
        const metersToMerc = mercatorZfromAltitude(1.0, this._center.lat);
        start[2] /= metersToMerc;
        dir[2] /= metersToMerc;
        vec3.normalize(dir, dir);

        const t = elevation.raycast(start, dir, elevation.exaggeration());

        if (t) {
            const point = vec3.scaleAndAdd([], start, dir, t);
            const newCenter = new MercatorCoordinate(point[0], point[1], mercatorZfromAltitude(point[2], latFromMercatorY(point[1])));

            const pos = this._camera.position;
            const camToNew = [newCenter.x - pos[0], newCenter.y - pos[1], newCenter.z - pos[2]];
            const maxAltitude = newCenter.z + vec3.length(camToNew);

            // Camera zoom has to be updated as the orbit distance might have changed
            this._cameraZoom = this._zoomFromMercatorZ(maxAltitude);
            this._centerAltitude = newCenter.toAltitude();
            this._center = newCenter.toLngLat();
            this._updateZoomFromElevation();
            this._constrain();
            this._calcMatrices();
        }
    }

    _constrainCameraAltitude() {
        if (!this._elevation)
            return;

        const elevation: Elevation = this._elevation;
        this._updateCameraState();
        const elevationAtCamera = elevation.getAtPoint(this._camera.mercatorPosition);

        const minHeight = this._minimumHeightOverTerrain() *  Math.cos(degToRad(this._maxPitch));
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

    /**
     * Returns the minimum zoom at which `this.width` can fit `this.lngRange`
     * and `this.height` can fit `this.latRange`.
     *
     * @returns {number} The zoom value.
     */
    _minZoomForBounds(): number {
        const minZoomForDim = (dim: number, range: [number, number]): number => {
            return Math.log2(dim / (this.tileSize * Math.abs(range[1] - range[0])));
        };
        let minLatZoom = DEFAULT_MIN_ZOOM;
        if (this.latRange) {
            const latRange = this.latRange;
            minLatZoom = minZoomForDim(this.height, [mercatorYfromLat(latRange[0]), mercatorYfromLat(latRange[1])]);
        }
        let minLngZoom = DEFAULT_MIN_ZOOM;
        if (this.lngRange) {
            const lngRange = this.lngRange;
            minLngZoom = minZoomForDim(this.width, [mercatorXfromLng(lngRange[0]), mercatorXfromLng(lngRange[1])]);
        }

        return Math.max(minLatZoom, minLngZoom);
    }

    /**
     * Returns the maximum distance of the camera from the center of the bounds, such that
     * `this.width` can fit `this.lngRange` and `this.height` can fit `this.latRange`.
     * In mercator units.
     *
     * @returns {number} The mercator z coordinate.
     */
    _maxCameraBoundsDistance(): number {
        return this._mercatorZfromZoom(this._minZoomForBounds());
    }

    _calcMatrices() {
        if (!this.height) return;

        const halfFov = this._fov / 2;
        const offset = this.centerOffset;
        this.cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this.height;
        const pixelsPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;

        this._updateCameraState();

        // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
        // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
        // 1 Z unit is equivalent to 1 horizontal px at the center of the map
        // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
        const groundAngle = Math.PI / 2 + this._pitch;
        const fovAboveCenter = this.fovAboveCenter;

        // Adjust distance to MSL by the minimum possible elevation visible on screen,
        // this way the far plane is pushed further in the case of negative elevation.
        const minElevationInPixels = this.elevation ?
            this.elevation.getMinElevationBelowMSL() * pixelsPerMeter :
            0;
        const cameraToSeaLevelDistance = ((this._camera.position[2] * this.worldSize) - minElevationInPixels) / Math.cos(this._pitch);
        const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * cameraToSeaLevelDistance / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));
        const point = this.point;
        const x = point.x, y = point.y;

        // Calculate z distance of the farthest fragment that should be rendered.
        const furthestDistance = Math.cos(Math.PI / 2 - this._pitch) * topHalfSurfaceDistance + cameraToSeaLevelDistance;
        // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`

        const horizonDistance = cameraToSeaLevelDistance * (1 / this._horizonShift);

        const farZ = Math.min(furthestDistance * 1.01, horizonDistance);

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
        // The distance in pixels the skybox needs to be shifted down by to meet the shifted horizon.
        const skyboxHorizonShift = (Math.PI / 2 - this._pitch) * (this.height / this._fov) * this._horizonShift;
        // Apply center of perspective offset to skybox projection
        projection[8] = -offset.x * 2 / this.width;
        projection[9] = (offset.y + skyboxHorizonShift) * 2 / this.height;
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
        const altitude = this._mercatorZfromZoom(zoom);
        const height = altitude - mercatorZfromAltitude(this._centerAltitude, this.center.lat);

        // simplified version of: this._worldSizeFromZoom(this._zoomFromMercatorZ(height))
        const updatedWorldSize = this.cameraToCenterDistance / height;

        this._camera.position = [
            center.x / this.worldSize - (dir[0] * distance) / updatedWorldSize,
            center.y / this.worldSize - (dir[1] * distance) / updatedWorldSize,
            mercatorZfromAltitude(this._centerAltitude, this._center.lat) + (-dir[2] * distance) / updatedWorldSize
        ];
    }

    /**
     * Apply a 3d translation to the camera position, but clamping it so that
     * it respects the bounds set by `this.latRange` and `this.lngRange`.
     *
     * @param {vec3} translation The translation vector.
     */
    _translateCameraConstrained(translation: vec3) {
        const maxDistance = this._maxCameraBoundsDistance();
        // Define a ceiling in mercator Z
        const maxZ = maxDistance * Math.cos(this._pitch);
        const z = this._camera.position[2];
        const deltaZ = translation[2];
        let t = 1;
        // we only need to clamp if the camera is moving upwards
        if (deltaZ > 0) {
            t = Math.min((maxZ - z) / deltaZ, 1);
        }

        this._camera.position = vec3.scaleAndAdd([], this._camera.position, translation, t);
        this._updateStateFromCamera();
    }

    _updateStateFromCamera() {
        const position = this._camera.position;
        const dir = this._camera.forward();
        const {pitch, bearing} = this._camera.getPitchBearing();

        // Compute zoom from the distance between camera and terrain
        const centerAltitude = mercatorZfromAltitude(this._centerAltitude, this.center.lat);
        const minHeight = this._mercatorZfromZoom(this._maxZoom) * Math.cos(degToRad(this._maxPitch));
        const height = Math.max((position[2] - centerAltitude) / Math.cos(pitch), minHeight);
        const zoom = this._zoomFromMercatorZ(height);

        // Cast a ray towards the ground to find the center point
        vec3.scaleAndAdd(position, position, dir, height);

        this._pitch = clamp(pitch, degToRad(this.minPitch), degToRad(this.maxPitch));
        this.angle = wrap(bearing, -Math.PI, Math.PI);
        this._setZoom(clamp(zoom, this._minZoom, this._maxZoom));

        if (this._terrainEnabled())
            this._updateCameraOnTerrain();

        this._center = new MercatorCoordinate(position[0], position[1], position[2]).toLngLat();
        this._unmodified = false;
        this._constrain();
        this._calcMatrices();
    }

    _worldSizeFromZoom(zoom: number): number {
        return Math.pow(2.0, zoom) * this.tileSize;
    }

    _mercatorZfromZoom(zoom: number): number {
        return this.cameraToCenterDistance / this._worldSizeFromZoom(zoom);
    }

    _minimumHeightOverTerrain() {
        // Determine minimum height for the camera over the terrain related to current zoom.
        // Values above than 2 allow max-pitch camera closer to e.g. top of the hill, exposing
        // drape raster overscale artifacts or cut terrain (see under it) as it gets clipped on
        // near plane. Returned value is in mercator coordinates.
        const MAX_DRAPE_OVERZOOM = 2;
        const zoom = Math.min((this._cameraZoom != null ? this._cameraZoom : this._zoom) + MAX_DRAPE_OVERZOOM, this._maxZoom);
        return this._mercatorZfromZoom(zoom);
    }

    _zoomFromMercatorZ(z: number): number {
        return this.scaleZoom(this.cameraToCenterDistance / (z * this.tileSize));
    }

    _terrainEnabled(): boolean {
        return !!this._elevation;
    }

    isHorizonVisibleForPoints(p0: Point, p1: Point): boolean {
        const minX = Math.min(p0.x, p1.x);
        const maxX = Math.max(p0.x, p1.x);
        const minY = Math.min(p0.y, p1.y);
        const maxY = Math.max(p0.y, p1.y);

        const min = new Point(minX, minY);
        const max = new Point(maxX, maxY);

        const corners = [
            min, max,
            new Point(minX, maxY),
            new Point(maxX, minY),
        ];

        const minWX = (this._renderWorldCopies) ? -NUM_WORLD_COPIES : 0;
        const maxWX = (this._renderWorldCopies) ? 1 + NUM_WORLD_COPIES : 1;
        const minWY = 0;
        const maxWY = 1;

        for (const corner of corners) {
            const rayIntersection = this.pointRayIntersection(corner);
            if (rayIntersection.t < 0) {
                return true;
            }
            const coordinate = this.rayIntersectionCoordinate(rayIntersection);
            if (coordinate.x < minWX || coordinate.y < minWY ||
                coordinate.x > maxWX || coordinate.y > maxWY) {
                return true;
            }
        }

        return false;
    }

    // Checks the four corners of the frustum to see if they lie in the map's quad.
    isHorizonVisible(): boolean {
        // we consider the horizon as visible if the angle between
        // a the top plane of the frustum and the map plane is smaller than this threshold.
        const horizonAngleEpsilon = 2;
        if (this.pitch + radToDeg(this.fovAboveCenter) > (90 - horizonAngleEpsilon)) {
            return true;
        }

        return this.isHorizonVisibleForPoints(new Point(0, 0), new Point(this.width, this.height));
    }

    /**
     * Converts a zoom delta value into a physical distance travelled in web mercator coordinates.
     * @param {vec3} center Destination mercator point of the movement.
     * @param {number} zoomDelta Change in the zoom value.
     * @returns {number} The distance in mercator coordinates.
     */
    zoomDeltaToMovement(center: vec3, zoomDelta: number): number {
        const distance = vec3.length(vec3.sub([], this._camera.position, center));
        const relativeZoom = this._zoomFromMercatorZ(distance) + zoomDelta;
        return distance - this._mercatorZfromZoom(relativeZoom);
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
}

export default Transform;
