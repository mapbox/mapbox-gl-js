// @flow

import LngLat from './lng_lat.js';
import LngLatBounds from './lng_lat_bounds.js';
import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude, latFromMercatorY, MAX_MERCATOR_LATITUDE, circumferenceAtLatitude} from './mercator_coordinate.js';
import {getProjection} from './projection/index.js';
import {tileAABB} from '../geo/projection/tile_transform.js';
import Point from '@mapbox/point-geometry';
import {wrap, clamp, pick, radToDeg, degToRad, getAABBPointSquareDist, furthestTileCorner, warnOnce, deepEqual} from '../util/util.js';
import {number as interpolate} from '../style-spec/util/interpolate.js';
import EXTENT from '../data/extent.js';
import {vec4, mat4, mat2, vec3, quat} from 'gl-matrix';
import {Frustum, Ray} from '../util/primitives.js';
import EdgeInsets from './edge_insets.js';
import {FreeCamera, FreeCameraOptions, orientationFromFrame} from '../ui/free_camera.js';
import assert from 'assert';
import getProjectionAdjustments, {getProjectionAdjustmentInverted, getScaleAdjustment} from './projection/adjustments.js';
import {getPixelsToTileUnitsMatrix} from '../source/pixels_to_tile_units.js';
import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import {calculateGlobeMatrix} from '../geo/projection/globe_util.js';

import type Projection from '../geo/projection/projection.js';
import type {Elevation} from '../terrain/elevation.js';
import type {PaddingOptions} from './edge_insets.js';
import type Tile from '../source/tile.js';
import type {ProjectionSpecification} from '../style-spec/types.js';
import type {FeatureDistanceData} from '../style-spec/feature_filter/index.js';
import type {Vec3, Vec4, Quat} from 'gl-matrix';

const NUM_WORLD_COPIES = 3;
const DEFAULT_MIN_ZOOM = 0;

type RayIntersectionResult = { p0: Vec4, p1: Vec4, t: number};
type ElevationReference = "sea" | "ground";

/**
 * A single transform, generally used for a single tile to be
 * scaled, rotated, and zoomed.
 * @private
 */
class Transform {
    tileSize: number;
    tileZoom: number;
    maxBounds: ?LngLatBounds;

    // 2^zoom (worldSize = tileSize * scale)
    scale: number;

    // Map viewport size (not including the pixel ratio)
    width: number;
    height: number;

    // Bearing, radians, in [-pi, pi]
    angle: number;

    // 2D rotation matrix in the horizontal plane, as a function of bearing
    rotationMatrix: Float32Array;

    // Zoom, modulo 1
    zoomFraction: number;

    // The scale factor component of the conversion from pixels ([0, w] x [h, 0]) to GL
    // NDC ([1, -1] x [1, -1]) (note flipped y)
    pixelsToGLUnits: [number, number];

    // Distance from camera to the center, in screen pixel units, independent of zoom
    cameraToCenterDistance: number;

    // Projection from mercator coordinates ([0, 0] nw, [1, 1] se) to GL clip coordinates
    mercatorMatrix: Array<number>;

    // Translate points in mercator coordinates to be centered about the camera, with units chosen
    // for screen-height-independent scaling of fog. Not affected by orientation of camera.
    mercatorFogMatrix: Float32Array;

    // Projection from world coordinates (mercator scaled by worldSize) to clip coordinates
    projMatrix: Array<number>;
    invProjMatrix: Float64Array;

    // Same as projMatrix, pixel-aligned to avoid fractional pixels for raster tiles
    alignedProjMatrix: Float64Array;

    // From world coordinates to screen pixel coordinates (projMatrix premultiplied by labelPlaneMatrix)
    pixelMatrix: Float64Array;
    pixelMatrixInverse: Float64Array;

    worldToFogMatrix: Float64Array;
    skyboxMatrix: Float32Array;

    // Transform from screen coordinates to GL NDC, [0, w] x [h, 0] --> [-1, 1] x [-1, 1]
    // Roughly speaking, applies pixelsToGLUnits scaling with a translation
    glCoordMatrix: Float32Array;

    // Inverse of glCoordMatrix, from NDC to screen coordinates, [-1, 1] x [-1, 1] --> [0, w] x [h, 0]
    labelPlaneMatrix: Float32Array;

    // globe coordinate transformation matrix
    globeMatrix: Float64Array;

    inverseAdjustmentMatrix: Array<number>;

    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
    worldMinX: number;
    worldMaxX: number;
    worldMinY: number;
    worldMaxY: number;

    freezeTileCoverage: boolean;
    cameraElevationReference: ElevationReference;
    fogCullDistSq: ?number;
    _averageElevation: number;
    projectionOptions: ProjectionSpecification;
    projection: Projection;
    _elevation: ?Elevation;
    _fov: number;
    _pitch: number;
    _zoom: number;
    _seaLevelZoom: ?number;
    _unmodified: boolean;
    _renderWorldCopies: boolean;
    _minZoom: number;
    _maxZoom: number;
    _minPitch: number;
    _maxPitch: number;
    _center: LngLat;
    _edgeInsets: EdgeInsets;
    _constraining: boolean;
    _projMatrixCache: {[_: number]: Float32Array};
    _alignedProjMatrixCache: {[_: number]: Float32Array};
    _pixelsToTileUnitsCache: {[_: number]: Float32Array};
    _fogTileMatrixCache: {[_: number]: Float32Array};
    _distanceTileDataCache: {[_: number]: FeatureDistanceData};
    _camera: FreeCamera;
    _centerAltitude: number;
    _centerAltitudeValidForExaggeration: number;
    _horizonShift: number;
    _projectionScaler: number;
    _nearZ: number;
    _farZ: number;

    constructor(minZoom: ?number, maxZoom: ?number, minPitch: ?number, maxPitch: ?number, renderWorldCopies: boolean | void, projection?: ?ProjectionSpecification, bounds: ?LngLatBounds) {
        this.tileSize = 512; // constant

        this._renderWorldCopies = renderWorldCopies === undefined ? true : renderWorldCopies;
        this._minZoom = minZoom || DEFAULT_MIN_ZOOM;
        this._maxZoom = maxZoom || 22;

        this._minPitch = (minPitch === undefined || minPitch === null) ? 0 : minPitch;
        this._maxPitch = (maxPitch === undefined || maxPitch === null) ? 60 : maxPitch;

        this.setProjection(projection);
        this.setMaxBounds(bounds);

        this.width = 0;
        this.height = 0;
        this._center = new LngLat(0, 0);
        this.zoom = 0;
        this.angle = 0;
        this._fov = 0.6435011087932844;
        this._pitch = 0;
        this._nearZ = 0;
        this._farZ = 0;
        this._unmodified = true;
        this._edgeInsets = new EdgeInsets();
        this._projMatrixCache = {};
        this._alignedProjMatrixCache = {};
        this._fogTileMatrixCache = {};
        this._distanceTileDataCache = {};
        this._camera = new FreeCamera();
        this._centerAltitude = 0;
        this._centerAltitudeValidForExaggeration = 0;
        this._averageElevation = 0;
        this.cameraElevationReference = "ground";
        this._projectionScaler = 1.0;

        // Move the horizon closer to the center. 0 would not shift the horizon. 1 would put the horizon at the center.
        this._horizonShift = 0.1;
    }

    clone(): Transform {
        const clone = new Transform(this._minZoom, this._maxZoom, this._minPitch, this.maxPitch, this._renderWorldCopies, this.getProjection());
        clone._elevation = this._elevation;
        clone._centerAltitude = this._centerAltitude;
        clone._centerAltitudeValidForExaggeration = this._centerAltitudeValidForExaggeration;
        clone.tileSize = this.tileSize;
        clone.width = this.width;
        clone.height = this.height;
        clone.cameraElevationReference = this.cameraElevationReference;
        clone._center = this._center;
        clone._setZoom(this.zoom);
        clone._seaLevelZoom = this._seaLevelZoom;
        clone.angle = this.angle;
        clone._fov = this._fov;
        clone._pitch = this._pitch;
        clone._nearZ = this._nearZ;
        clone._farZ = this._farZ;
        clone._averageElevation = this._averageElevation;
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
        this._updateCameraOnTerrain();
        this._calcMatrices();
    }
    updateElevation(constrainCameraOverTerrain: boolean) { // On render, no need for higher granularity on update reasons.
        const centerAltitudeChanged = this._elevation && this._elevation.exaggeration() !== this._centerAltitudeValidForExaggeration;
        if (this._seaLevelZoom == null || centerAltitudeChanged) {
            this._updateCameraOnTerrain();
        }
        if (constrainCameraOverTerrain || centerAltitudeChanged) {
            this._constrainCameraAltitude();
        }
        this._calcMatrices();
    }

    getProjection(): ProjectionSpecification {
        return (pick(this.projection, ['name', 'center', 'parallels']): ProjectionSpecification);
    }

    // Returns the new projection if the projection changes, or null if no change.
    setProjection(projection?: ?ProjectionSpecification): ProjectionSpecification | null {
        if (projection === undefined || projection === null) projection = {name: 'mercator'};
        this.projectionOptions = projection;

        const oldProjection = this.projection ? this.getProjection() : undefined;
        this.projection = getProjection(projection);
        const newProjection = this.getProjection();

        if (deepEqual(oldProjection, newProjection)) {
            return null;
        }
        this._calcMatrices();
        return newProjection;
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

    get renderWorldCopies(): boolean {
        return this._renderWorldCopies && this.projection.supportsWorldCopies === true;
    }
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

    get cameraWorldSize(): number {
        const distance = Math.max(this._camera.getDistanceToElevation(this._averageElevation), Number.EPSILON);
        return this._worldSizeFromZoom(this._zoomFromMercatorZ(distance));
    }

    get pixelsPerMeter(): number {
        return this.projection.pixelsPerMeter(this.center.lat, this.worldSize);
    }

    get cameraPixelsPerMeter(): number {
        return this.projection.pixelsPerMeter(this.center.lat, this.cameraWorldSize);
    }

    get centerOffset(): Point {
        return this.centerPoint._sub(this.size._div(2));
    }

    get size(): Point {
        return new Point(this.width, this.height);
    }

    get bearing(): number {
        return wrap(this.rotation, -180, 180);
    }

    set bearing(bearing: number) {
        this.rotation = bearing;
    }

    get rotation(): number {
        return -this.angle / Math.PI * 180;
    }

    set rotation(rotation: number) {
        const b = -rotation * Math.PI / 180;
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

    get averageElevation(): number {
        return this._averageElevation;
    }
    set averageElevation(averageElevation: number) {
        this._averageElevation = averageElevation;
        this._calcFogMatrices();
        this._distanceTileDataCache = {};
    }

    get zoom(): number { return this._zoom; }
    set zoom(zoom: number) {
        const z = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
        if (this._zoom === z) return;
        this._unmodified = false;
        this._setZoom(z);
        this._updateSeaLevelZoom();
        this._constrain();
        this._calcMatrices();
    }
    _setZoom(z: number) {
        this._zoom = z;
        this.scale = this.zoomScale(z);
        this.tileZoom = Math.floor(z);
        this.zoomFraction = z - this.tileZoom;
    }

    _updateCameraOnTerrain() {
        if (!this._elevation || !this._elevation.isDataAvailableAtPoint(this.locationCoordinate(this.center))) {
            // Elevation data not loaded yet, reset
            this._centerAltitude = 0;
            this._seaLevelZoom = null;
            this._centerAltitudeValidForExaggeration = 0;
            return;
        }
        const elevation: Elevation = this._elevation;
        this._centerAltitude = elevation.getAtPointOrZero(this.locationCoordinate(this.center));
        this._centerAltitudeValidForExaggeration = elevation.exaggeration();
        this._updateSeaLevelZoom();
    }

    _updateSeaLevelZoom() {
        if (this._centerAltitudeValidForExaggeration === 0) {
            return;
        }
        const height = this.cameraToCenterDistance;
        const terrainElevation = this.pixelsPerMeter * this._centerAltitude;
        const mercatorZ = (terrainElevation + height) / this.worldSize;

        // MSL (Mean Sea Level) zoom describes the distance of the camera to the sea level (altitude).
        // It is used only for manipulating the camera location. The standard zoom (this._zoom)
        // defines the camera distance to the terrain (height). Its behavior and conceptual
        // meaning in determining which tiles to stream is same with or without the terrain.
        this._seaLevelZoom = this._zoomFromMercatorZ(mercatorZ);
    }

    sampleAverageElevation(): number {
        if (!this._elevation) return 0;
        const elevation: Elevation = this._elevation;

        const elevationSamplePoints = [
            [0.5, 0.2],
            [0.3, 0.5],
            [0.5, 0.5],
            [0.7, 0.5],
            [0.5, 0.8]
        ];

        const horizon = this.horizonLineFromTop();

        let elevationSum = 0.0;
        let weightSum = 0.0;
        for (let i = 0; i < elevationSamplePoints.length; i++) {
            const pt = new Point(
                elevationSamplePoints[i][0] * this.width,
                horizon + elevationSamplePoints[i][1] * (this.height - horizon)
            );
            const hit = elevation.pointCoordinate(pt);
            if (!hit) continue;

            const distanceToHit = Math.hypot(hit[0] - this._camera.position[0], hit[1] - this._camera.position[1]);
            const weight = 1 / distanceToHit;
            elevationSum += hit[3] * weight;
            weightSum += weight;
        }

        if (weightSum === 0) return NaN;
        return elevationSum / weightSum;
    }

    get center(): LngLat { return this._center; }
    set center(center: LngLat) {
        if (center.lat === this._center.lat && center.lng === this._center.lng) return;

        this._unmodified = false;
        this._center = center;
        if (this._terrainEnabled()) {
            if (this.cameraElevationReference === "ground") {
                this._updateCameraOnTerrain();
            } else {
                this._updateZoomFromElevation();
            }
        }
        this._constrain();
        this._calcMatrices();
    }

    _updateZoomFromElevation() {
        if (this._seaLevelZoom == null || !this._elevation)
            return;

        // Compute zoom level from the height of the camera relative to the terrain
        const seaLevelZoom: number = this._seaLevelZoom;
        const elevationAtCenter = this._elevation.getAtPointOrZero(this.locationCoordinate(this.center));
        const mercatorElevation = this.pixelsPerMeter / this.worldSize * elevationAtCenter;
        const altitude  = this._mercatorZfromZoom(seaLevelZoom);
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
     *
     * @param {MercatorCoordinate} position A position defining the altitude of the the map plane.
     * @returns {number} The zoom value.
     */
    computeZoomRelativeTo(position: MercatorCoordinate): number {
        // Find map center position on the target plane by casting a ray from screen center towards the plane.
        // Direct distance to the target position is used if the target position is above camera position.
        const centerOnTargetAltitude = this.rayIntersectionCoordinate(this.pointRayIntersection(this.centerPoint, position.toAltitude()));

        let targetPosition: ?Vec3;
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
        options._renderWorldCopies = this.renderWorldCopies;

        return options;
    }

    _setCameraOrientation(orientation: Quat): boolean {
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

    _setCameraPosition(position: Vec3) {
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
     * Return the highest zoom level that fully includes all tiles within the transform's boundaries.
     * @param {Object} options Options.
     * @param {number} options.tileSize Tile size, expressed in screen pixels.
     * @param {boolean} options.roundZoom Target zoom level. If true, the value will be rounded to the closest integer. Otherwise the value will be floored.
     * @returns {number} An integer zoom level at which all tiles will be visible.
     */
    coveringZoomLevel(options: {roundZoom?: boolean, tileSize: number}): number {
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
    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): Array<UnwrappedTileID> {
        const result = [new UnwrappedTileID(0, tileID)];
        if (this.renderWorldCopies) {
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
            isTerrainDEM?: boolean
        }
    ): Array<OverscaledTileID> {
        let z = this.coveringZoomLevel(options);
        const actualZ = z;

        const useElevationData = this.elevation && !options.isTerrainDEM;
        const isMercator = this.projection.name === 'mercator';

        if (options.minzoom !== undefined && z < options.minzoom) return [];
        if (options.maxzoom !== undefined && z > options.maxzoom) z = options.maxzoom;

        const centerCoord = this.locationCoordinate(this.center);
        const centerLatitude = this.center.lat;
        const numTiles = 1 << z;
        const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
        const isGlobe = this.projection.name === 'globe';
        const zInMeters = !isGlobe;
        const cameraFrustum = Frustum.fromInvProjectionMatrix(this.invProjMatrix, this.worldSize, z, zInMeters);
        const cameraCoord = isGlobe ? this._camera.mercatorPosition : this.pointCoordinate(this.getCameraPoint());
        const meterToTile = numTiles * mercatorZfromAltitude(1, this.center.lat);
        const cameraAltitude = this._camera.position[2] / mercatorZfromAltitude(1, this.center.lat);
        const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, cameraAltitude * (zInMeters ? 1 : meterToTile)];
        // Let's consider an example for !roundZoom: e.g. tileZoom 16 is used from zoom 16 all the way to zoom 16.99.
        // This would mean that the minimal distance to split would be based on distance from camera to center of 16.99 zoom.
        // The same is already incorporated in logic behind roundZoom for raster (so there is no adjustment needed in following line).
        // 0.02 added to compensate for precision errors, see "coveringTiles for terrain" test in transform.test.js.
        const zoomSplitDistance = this.cameraToCenterDistance / options.tileSize * (options.roundZoom ? 1 : 0.502);

        // No change of LOD behavior for pitch lower than 60 and when there is no top padding: return only tile ids from the requested zoom level
        const minZoom = this.pitch <= 60.0 && this._edgeInsets.top <= this._edgeInsets.bottom && !this._elevation && !this.projection.isReprojectedInTileSpace ? z : 0;

        // When calculating tile cover for terrain, create deep AABB for nodes, to ensure they intersect frustum: for sources,
        // other than DEM, use minimum of visible DEM tiles and center altitude as upper bound (pitch is always less than 90°).
        const maxRange = options.isTerrainDEM && this._elevation ? this._elevation.exaggeration() * 10000 : this._centerAltitude;
        const minRange = options.isTerrainDEM ? -maxRange : this._elevation ? this._elevation.getMinElevationBelowMSL() : 0;

        const scaleAdjustment = this.projection.isReprojectedInTileSpace ? getScaleAdjustment(this) : 1.0;

        const relativeScaleAtMercatorCoord = mc => {
            // Calculate how scale compares between projected coordinates and mercator coordinates.
            // Returns a length. The units don't matter since the result is only
            // used in a ratio with other values returned by this function.

            // Construct a small square in Mercator coordinates.
            const offset = 1 / 40000;
            const mcEast = new MercatorCoordinate(mc.x + offset, mc.y, mc.z);
            const mcSouth = new MercatorCoordinate(mc.x, mc.y + offset, mc.z);

            // Convert the square to projected coordinates.
            const ll = mc.toLngLat();
            const llEast = mcEast.toLngLat();
            const llSouth = mcSouth.toLngLat();
            const p = this.locationCoordinate(ll);
            const pEast = this.locationCoordinate(llEast);
            const pSouth = this.locationCoordinate(llSouth);

            // Calculate the size of each edge of the reprojected square
            const dx = Math.hypot(pEast.x - p.x, pEast.y - p.y);
            const dy = Math.hypot(pSouth.x - p.x, pSouth.y - p.y);

            // Calculate the size of a projected square that would have the
            // same area as the reprojected square.
            return Math.sqrt(dx * dy) * scaleAdjustment / offset;
        };

        const newRootTile = (wrap: number): any => {
            const max = maxRange;
            const min = minRange;
            return {
                // With elevation, this._elevation provides z coordinate values. For 2D:
                // All tiles are on zero elevation plane => z difference is zero
                aabb: tileAABB(this, numTiles, 0, 0, 0, wrap, min, max, this.projection),
                zoom: 0,
                x: 0,
                y: 0,
                minZ: min,
                maxZ: max,
                wrap,
                fullyVisible: false
            };
        };

        // Do a depth-first traversal to find visible tiles and proper levels of detail
        const stack = [];
        let result = [];
        const maxZoom = z;
        const overscaledZ = options.reparseOverscaled ? actualZ : z;
        const square = a => a * a;
        const cameraHeightSqr = square((cameraAltitude - this._centerAltitude) * meterToTile); // in tile coordinates.

        const getAABBFromElevation = (it) => {
            assert(this._elevation);
            if (!this._elevation || !it.tileID || !isMercator) return; // To silence flow.
            const minmax = this._elevation.getMinMaxForTile(it.tileID);
            const aabb = it.aabb;
            if (minmax) {
                aabb.min[2] = minmax.min;
                aabb.max[2] = minmax.max;
                aabb.center[2] = (aabb.min[2] + aabb.max[2]) / 2;
            } else {
                it.shouldSplit = shouldSplit(it);
                if (!it.shouldSplit) {
                    // At final zoom level, while corresponding DEM tile is not loaded yet,
                    // assume center elevation. This covers ground to horizon and prevents
                    // loading unnecessary tiles until DEM cover is fully loaded.
                    aabb.min[2] = aabb.max[2] = aabb.center[2] = this._centerAltitude;
                }
            }
        };

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

        const shouldSplit = (it) => {
            if (it.zoom < minZoom) {
                return true;
            } else if (it.zoom === maxZoom) {
                return false;
            }
            if (it.shouldSplit != null) {
                return it.shouldSplit;
            }
            const dx = it.aabb.distanceX(cameraPoint);
            const dy = it.aabb.distanceY(cameraPoint);
            let dzSqr = cameraHeightSqr;

            let tileScaleAdjustment = 1;
            if (isGlobe) {
                dzSqr = square(it.aabb.distanceZ(cameraPoint));
                // Compensate physical sizes of the tiles when determining which zoom level to use.
                // In practice tiles closer to poles should use more aggressive LOD as their
                // physical size is already smaller than size of tiles near the equator.
                const tilesAtZoom = Math.pow(2, it.zoom);
                const minLat = latFromMercatorY((it.y + 1) / tilesAtZoom);
                const maxLat = latFromMercatorY((it.y) / tilesAtZoom);
                const closestLat = Math.min(Math.max(centerLatitude, minLat), maxLat);
                const scale = circumferenceAtLatitude(closestLat) / circumferenceAtLatitude(centerLatitude);
                tileScaleAdjustment = Math.min(scale, 1.0);
            } else {
                assert(zInMeters);
                if (useElevationData) {
                    dzSqr = square(it.aabb.distanceZ(cameraPoint) * meterToTile);
                }
                if (this.projection.isReprojectedInTileSpace && actualZ <= 5) {
                    // In other projections, not all tiles are the same size.
                    // Account for the tile size difference by adjusting the distToSplit.
                    // Adjust by the ratio of the area at the tile center to the area at the map center.
                    // Adjustments are only needed at lower zooms where tiles are not similarly sized.
                    const numTiles = Math.pow(2, it.zoom);
                    const relativeScale = relativeScaleAtMercatorCoord(new MercatorCoordinate((it.x + 0.5) / numTiles, (it.y + 0.5) / numTiles));
                    // Fudge the ratio slightly so that all tiles near the center have the same zoom level.
                    tileScaleAdjustment = relativeScale > 0.85 ? 1 : relativeScale;
                }
            }

            const distanceSqr = dx * dx + dy * dy + dzSqr;
            const distToSplit = (1 << maxZoom - it.zoom) * zoomSplitDistance * tileScaleAdjustment;
            const distToSplitSqr = square(distToSplit * distToSplitScale(Math.max(dzSqr, cameraHeightSqr), distanceSqr));

            return distanceSqr < distToSplitSqr;
        };

        if (this.renderWorldCopies) {
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

            // Visibility of a tile is not required if any of its ancestor is fully inside the frustum
            if (!fullyVisible) {
                const intersectResult = it.aabb.intersects(cameraFrustum);

                if (intersectResult === 0)
                    continue;

                fullyVisible = intersectResult === 2;
            }

            // Have we reached the target depth or is the tile too far away to be any split further?
            if (it.zoom === maxZoom || !shouldSplit(it)) {
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

                const aabb = isMercator ? it.aabb.quadrant(i) : tileAABB(this, numTiles, it.zoom + 1, childX, childY, it.wrap, it.minZ, it.maxZ, this.projection);
                const child = {aabb, zoom: it.zoom + 1, x: childX, y: childY, wrap: it.wrap, fullyVisible, tileID: undefined, shouldSplit: undefined, minZ: it.minZ, maxZ: it.maxZ};
                if (useElevationData && !isGlobe) {
                    child.tileID = new OverscaledTileID(it.zoom + 1 === maxZoom ? overscaledZ : it.zoom + 1, it.wrap, it.zoom + 1, childX, childY);
                    getAABBFromElevation(child);
                }
                stack.push(child);
            }
        }

        if (this.fogCullDistSq) {
            const fogCullDistSq = this.fogCullDistSq;
            const horizonLineFromTop = this.horizonLineFromTop();
            result = result.filter(entry => {
                const min = [0, 0, 0, 1];
                const max = [EXTENT, EXTENT, 0, 1];

                const fogTileMatrix = this.calculateFogTileMatrix(entry.tileID.toUnwrapped());

                vec4.transformMat4(min, min, fogTileMatrix);
                vec4.transformMat4(max, max, fogTileMatrix);

                const sqDist = getAABBPointSquareDist(min, max);

                if (sqDist === 0) { return true; }

                let overHorizonLine = false;

                // Terrain loads at one zoom level lower than the raster data,
                // so the following checks whether the terrain sits above the horizon and ensures that
                // when mountains stick out above the fog (due to horizon-blend),
                // we haven’t accidentally culled some of the raster tiles we need to draw on them.
                // If we don’t do this, the terrain is default black color and may flash in and out as we move toward it.

                const elevation = this._elevation;

                if (elevation && sqDist > fogCullDistSq && horizonLineFromTop !== 0) {
                    const projMatrix = this.calculateProjMatrix(entry.tileID.toUnwrapped());

                    let minmax;
                    if (!options.isTerrainDEM) {
                        minmax = elevation.getMinMaxForTile(entry.tileID);
                    }

                    if (!minmax) { minmax = {min: minRange, max: maxRange}; }

                    // ensure that we want `this.rotation` instead of `this.bearing` here
                    const cornerFar = furthestTileCorner(this.rotation);

                    const farX = cornerFar[0] * EXTENT;
                    const farY = cornerFar[1] * EXTENT;

                    const worldFar = [farX, farY, minmax.max];

                    // World to NDC
                    vec3.transformMat4(worldFar, worldFar, projMatrix);

                    // NDC to Screen
                    const screenCoordY = (1 - worldFar[1]) * this.height * 0.5;

                    // Prevent cutting tiles crossing over the horizon line to
                    // prevent pop-in and out within the fog culling range
                    overHorizonLine = screenCoordY < horizonLineFromTop;
                }

                return sqDist < fogCullDistSq || overHorizonLine;
            });
        }

        const cover = result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
        // Relax the assertion on terrain, on high zoom we use distance to center of tile
        // while camera might be closer to selected center of map.
        assert(!cover.length || this.elevation || cover[0].overscaledZ === overscaledZ || !isMercator);
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

    zoomScale(zoom: number): number { return Math.pow(2, zoom); }
    scaleZoom(scale: number): number { return Math.log(scale) / Math.LN2; }

    // Transform from LngLat to Point in world coordinates [-180, 180] x [90, -90] --> [0, this.worldSize] x [0, this.worldSize]
    project(lnglat: LngLat): Point {
        const lat = clamp(lnglat.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
        const projectedLngLat = this.projection.project(lnglat.lng, lat);
        return new Point(
                projectedLngLat.x * this.worldSize,
                projectedLngLat.y * this.worldSize);
    }

    // Transform from Point in world coordinates to LngLat [0, this.worldSize] x [0, this.worldSize] --> [-180, 180] x [90, -90]
    unproject(point: Point): LngLat {
        return this.projection.unproject(point.x / this.worldSize, point.y / this.worldSize);
    }

    // Point at center in world coordinates.
    get point(): Point { return this.project(this.center); }

    setLocationAtPoint(lnglat: LngLat, point: Point) {
        let x, y;
        const centerPoint = this.centerPoint;

        if (this.projection.name === 'globe') {
            // Pixel coordinates are applied directly to the globe
            const worldSize = this.worldSize;
            x = (point.x - centerPoint.x) / worldSize;
            y = (point.y - centerPoint.y) / worldSize;
        } else {
            const a = this.pointCoordinate(point);
            const b = this.pointCoordinate(centerPoint);
            x = a.x - b.x;
            y = a.y - b.y;
        }

        const loc = this.locationCoordinate(lnglat);
        this.setLocation(new MercatorCoordinate(loc.x - x, loc.y - y));
    }

    setLocation(location: MercatorCoordinate) {
        this.center = this.coordinateLocation(location);
        if (this.projection.wrap) {
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
    locationPoint(lnglat: LngLat): Point {
        return this.projection.locationPoint(this, lnglat);
    }

    /**
     * Given a location, return the screen point that corresponds to it
     * In 3D mode (when terrain is enabled) elevation is sampled for the point before
     * projecting it. In 2D mode, behaves the same locationPoint.
     * @param {LngLat} lnglat location
     * @returns {Point} screen point
     * @private
     */
    locationPoint3D(lnglat: LngLat): Point {
        return this._coordinatePoint(this.locationCoordinate(lnglat), true);
    }

    /**
     * Given a point on screen, return its lnglat
     * @param {Point} p screen point
     * @returns {LngLat} lnglat location
     * @private
     */
    pointLocation(p: Point): LngLat {
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
    pointLocation3D(p: Point): LngLat {
        return this.coordinateLocation(this.pointCoordinate3D(p));
    }

    /**
     * Given a geographical lngLat, return an unrounded
     * coordinate that represents it at this transform's zoom level.
     * @param {LngLat} lngLat
     * @returns {Coordinate}
     * @private
     */
    locationCoordinate(lngLat: LngLat, altitude?: number): MercatorCoordinate {
        const z = altitude ?
            mercatorZfromAltitude(altitude, lngLat.lat) :
            undefined;
        const projectedLngLat = this.projection.project(lngLat.lng, lngLat.lat);
        return new MercatorCoordinate(
            projectedLngLat.x,
            projectedLngLat.y,
            z);
    }

    /**
     * Given a Coordinate, return its geographical position.
     * @param {Coordinate} coord
     * @returns {LngLat} lngLat
     * @private
     */
    coordinateLocation(coord: MercatorCoordinate): LngLat {
        return this.projection.unproject(coord.x, coord.y);
    }

    /**
     * Casts a ray from a point on screen and returns the Ray,
     * and the extent along it, at which it intersects the map plane.
     *
     * @param {Point} p Viewport pixel co-ordinates.
     * @param {number} z Optional altitude of the map plane, defaulting to elevation at center.
     * @returns {{ p0: Vec4, p1: Vec4, t: number }} p0,p1 are two points on the ray.
     * t is the fractional extent along the ray at which the ray intersects the map plane.
     * @private
     */
    pointRayIntersection(p: Point, z: ?number): RayIntersectionResult {
        const targetZ = (z !== undefined && z !== null) ? z : this._centerAltitude;
        // Since we don't know the correct projected z value for the point,
        // unproject two points to get a line and then find the point on that
        // line with z=0.

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

        // Convert altitude from meters to pixels.
        p0[2] = mercatorZfromAltitude(p0[2], this._center.lat) * this.worldSize;
        p1[2] = mercatorZfromAltitude(p1[2], this._center.lat) * this.worldSize;

        vec4.scale(p0, p0, 1 / this.worldSize);
        vec4.scale(p1, p1, 1 / this.worldSize);

        return new Ray([p0[0], p0[1], p0[2]], vec3.normalize([], vec3.sub([], p1, p0)));
    }

    /**
     *  Helper method to convert the ray intersection with the map plane to MercatorCoordinate.
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
     * @param {Point} p Top left origin screen point, in pixels.
     * @param {number} z Optional altitude of the map plane, defaulting to elevation at center.
     * @private
     */
    pointCoordinate(p: Point, z?: number = this._centerAltitude): MercatorCoordinate {
        return this.projection.pointCoordinate(this, p.x, p.y, z);
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
     * This approximates the map as an infinite plane and does not account for z0-z3
     * wherein the map is small quad with whitespace above the north pole and below the south pole.
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
    _coordinatePoint(coord: MercatorCoordinate, sampleTerrainIn3D: boolean): Point {
        const elevation = sampleTerrainIn3D && this.elevation ? this.elevation.getAtPointOrZero(coord, this._centerAltitude) : this._centerAltitude;
        const p = [coord.x * this.worldSize, coord.y * this.worldSize, elevation + coord.toAltitude(), 1];
        vec4.transformMat4(p, p, this.pixelMatrix);
        return p[3] > 0 ?
            new Point(p[0] / p[3], p[1] / p[3]) :
            new Point(Number.MAX_VALUE, Number.MAX_VALUE);
    }

    _getBounds(min: number, max: number): LngLatBounds {
        const topLeft = new Point(this._edgeInsets.left, this._edgeInsets.top);
        const topRight = new Point(this.width - this._edgeInsets.right, this._edgeInsets.top);
        const bottomRight = new Point(this.width - this._edgeInsets.right, this.height - this._edgeInsets.bottom);
        const bottomLeft = new Point(this._edgeInsets.left, this.height - this._edgeInsets.bottom);

        // Consider far points at the maximum possible elevation
        // and near points at the minimum to ensure full coverage.
        let tl = this.pointCoordinate(topLeft, min);
        let tr = this.pointCoordinate(topRight, min);
        const br = this.pointCoordinate(bottomRight, max);
        const bl = this.pointCoordinate(bottomLeft, max);

        // Snap points if off the edges of map (Latitude is too high or low).
        const slope = (p1, p2) => (p2.y - p1.y) / (p2.x - p1.x);

        if (tl.y > 1 && tr.y >= 0) tl = new MercatorCoordinate((1 - bl.y) / slope(bl, tl) + bl.x, 1);
        else if (tl.y < 0 && tr.y <= 1) tl = new MercatorCoordinate(-bl.y / slope(bl, tl) + bl.x, 0);

        if (tr.y > 1 && tl.y >= 0) tr = new MercatorCoordinate((1 - br.y) / slope(br, tr) + br.x, 1);
        else if (tr.y < 0 && tl.y <= 1) tr = new MercatorCoordinate(-br.y / slope(br, tr) + br.x, 0);

        return new LngLatBounds()
            .extend(this.coordinateLocation(tl))
            .extend(this.coordinateLocation(tr))
            .extend(this.coordinateLocation(bl))
            .extend(this.coordinateLocation(br));
    }

    _getBounds3D(): LngLatBounds {
        assert(this.elevation);
        const elevation = ((this.elevation: any): Elevation);
        if (!elevation.visibleDemTiles.length) { return this._getBounds(0, 0); }
        const minmax = elevation.visibleDemTiles.reduce((acc, t) => {
            if (t.dem) {
                const tree = t.dem.tree;
                acc.min = Math.min(acc.min, tree.minimums[0]);
                acc.max = Math.max(acc.max, tree.maximums[0]);
            }
            return acc;
        }, {min: Number.MAX_VALUE, max: 0});
        assert(minmax.min !== Number.MAX_VALUE);
        return this._getBounds(minmax.min * elevation.exaggeration(), minmax.max * elevation.exaggeration());
    }

    /**
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     *
     * @returns {LngLatBounds} Returns a {@link LngLatBounds} object describing the map's geographical bounds.
     */
    getBounds(): LngLatBounds {
        if (this._terrainEnabled()) return this._getBounds3D();
        return this._getBounds(0, 0);
    }

    /**
     * Returns position of horizon line from the top of the map in pixels.
     * If horizon is not visible, returns 0 by default or a negative value if called with clampToTop = false.
     * @private
     */
    horizonLineFromTop(clampToTop: boolean = true): number {
        // h is height of space above map center to horizon.
        const h = this.height / 2 / Math.tan(this._fov / 2) / Math.tan(Math.max(this._pitch, 0.1)) + this.centerOffset.y;
        const offset = this.height / 2 - h * (1 - this._horizonShift);
        return clampToTop ? Math.max(0, offset) : offset;
    }

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     * @returns {LngLatBounds} {@link LngLatBounds}.
     */
    getMaxBounds(): ?LngLatBounds {
        return this.maxBounds;
    }

    /**
     * Sets or clears the map's geographical constraints.
     *
     * @param {LngLatBounds} bounds A {@link LngLatBounds} object describing the new geographic boundaries of the map.
     */
    setMaxBounds(bounds: ?LngLatBounds) {
        this.maxBounds = bounds;

        this.minLat = -MAX_MERCATOR_LATITUDE;
        this.maxLat = MAX_MERCATOR_LATITUDE;
        this.minLng = -180;
        this.maxLng = 180;

        if (bounds) {
            this.minLat = bounds.getSouth();
            this.maxLat = bounds.getNorth();
            this.minLng = bounds.getWest();
            this.maxLng = bounds.getEast();
            if (this.maxLng < this.minLng) this.maxLng += 360;
        }

        this.worldMinX = mercatorXfromLng(this.minLng) * this.tileSize;
        this.worldMaxX = mercatorXfromLng(this.maxLng) * this.tileSize;
        this.worldMinY = mercatorYfromLat(this.maxLat) * this.tileSize;
        this.worldMaxY = mercatorYfromLat(this.minLat) * this.tileSize;

        this._constrain();
    }

    calculatePosMatrix(unwrappedTileID: UnwrappedTileID, worldSize: number): Float64Array {
        return this.projection.createTileMatrix(this, worldSize, unwrappedTileID);
    }

    calculateDistanceTileData(unwrappedTileID: UnwrappedTileID): FeatureDistanceData {
        const distanceDataKey = unwrappedTileID.key;
        const cache = this._distanceTileDataCache;
        if (cache[distanceDataKey]) {
            return cache[distanceDataKey];
        }

        //Calculate the offset of the tile
        const canonical = unwrappedTileID.canonical;
        const windowScaleFactor = 1 / this.height;
        const scale = this.cameraWorldSize / this.zoomScale(canonical.z);
        const unwrappedX = canonical.x + Math.pow(2, canonical.z) * unwrappedTileID.wrap;
        const tX = unwrappedX * scale;
        const tY = canonical.y * scale;

        const center = this.point;

        // Calculate the bearing vector by rotating unit vector [0, -1] clockwise
        const angle = this.angle;
        const bX = Math.sin(-angle);
        const bY = -Math.cos(-angle);

        const cX = (center.x - tX) * windowScaleFactor;
        const cY = (center.y - tY) * windowScaleFactor;
        cache[distanceDataKey] = {
            bearing: [bX, bY],
            center: [cX, cY],
            scale: (scale / EXTENT) * windowScaleFactor
        };

        return cache[distanceDataKey];
    }

    /**
     * Calculate the fogTileMatrix that, given a tile coordinate, can be used to
     * calculate its position relative to the camera in units of pixels divided
     * by the map height. Used with fog for consistent computation of distance
     * from camera.
     *
     * @param {UnwrappedTileID} unwrappedTileID;
     * @private
     */
    calculateFogTileMatrix(unwrappedTileID: UnwrappedTileID): Float32Array {
        const fogTileMatrixKey = unwrappedTileID.key;
        const cache = this._fogTileMatrixCache;
        if (cache[fogTileMatrixKey]) {
            return cache[fogTileMatrixKey];
        }

        const posMatrix = this.calculatePosMatrix(unwrappedTileID, this.cameraWorldSize);
        mat4.multiply(posMatrix, this.worldToFogMatrix, posMatrix);

        cache[fogTileMatrixKey] = new Float32Array(posMatrix);
        return cache[fogTileMatrixKey];
    }

    /**
     * Calculate the projMatrix that, given a tile coordinate, would be used to display the tile on the screen.
     * @param {UnwrappedTileID} unwrappedTileID;
     * @private
     */
    calculateProjMatrix(unwrappedTileID: UnwrappedTileID, aligned: boolean = false): Float32Array {
        const projMatrixKey = unwrappedTileID.key;
        const cache = aligned ? this._alignedProjMatrixCache : this._projMatrixCache;
        if (cache[projMatrixKey]) {
            return cache[projMatrixKey];
        }

        const posMatrix = this.calculatePosMatrix(unwrappedTileID, this.worldSize);
        const projMatrix = this.projection.isReprojectedInTileSpace ?
            this.mercatorMatrix : (aligned ? this.alignedProjMatrix : this.projMatrix);
        mat4.multiply(posMatrix, projMatrix, posMatrix);

        cache[projMatrixKey] = new Float32Array(posMatrix);
        return cache[projMatrixKey];
    }

    calculatePixelsToTileUnitsMatrix(tile: Tile): Float32Array {
        const key = tile.tileID.key;
        const cache = this._pixelsToTileUnitsCache;
        if (cache[key]) {
            return cache[key];
        }

        const matrix = getPixelsToTileUnitsMatrix(tile, this);
        cache[key] = matrix;
        return cache[key];
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
        // We need to use a camera position that exists in the same coordinate space as the data.
        // The default camera position might have been compensated by the active projection model.
        const mercPixelsPerMeter = mercatorZfromAltitude(1, this._center.lat) * this.worldSize;
        const start = this._computeCameraPosition(mercPixelsPerMeter);
        const dir = this._camera.forward();

        // The raycast function expects z-component to be in meters
        const metersToMerc = mercatorZfromAltitude(1.0, this._center.lat);
        start[2] /= metersToMerc;
        dir[2] /= metersToMerc;
        vec3.normalize(dir, dir);

        const t = elevation.raycast(start, dir, elevation.exaggeration());

        if (t) {
            const point = vec3.scaleAndAdd([], start, dir, t);
            const newCenter = new MercatorCoordinate(point[0], point[1], mercatorZfromAltitude(point[2], latFromMercatorY(point[1])));

            const camToNew = [newCenter.x - start[0], newCenter.y - start[1], newCenter.z - start[2] * metersToMerc];
            const maxAltitude = (newCenter.z + vec3.length(camToNew)) * this._projectionScaler;
            this._seaLevelZoom = this._zoomFromMercatorZ(maxAltitude);

            // Camera zoom has to be updated as the orbit distance might have changed
            this._centerAltitude = newCenter.toAltitude();
            this._center = this.coordinateLocation(newCenter);
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

        // Find uncompensated camera position for elevation sampling.
        // The default camera position might have been compensated by the active projection model.
        const mercPixelsPerMeter = mercatorZfromAltitude(1, this._center.lat) * this.worldSize;
        const pos = this._computeCameraPosition(mercPixelsPerMeter);

        const elevationAtCamera = elevation.getAtPointOrZero(new MercatorCoordinate(...pos));
        const minHeight = this._minimumHeightOverTerrain() * Math.cos(degToRad(this._maxPitch));
        const terrainElevation = this.pixelsPerMeter / this.worldSize * elevationAtCamera;
        const cameraHeight = this._camera.position[2] - terrainElevation;

        if (cameraHeight < minHeight) {
            const center = this.locationCoordinate(this._center, this._centerAltitude);
            const cameraToCenter = [center.x - pos[0], center.y - pos[1], center.z - pos[2]];
            const prevDistToCamera = vec3.length(cameraToCenter);

            // Adjust the camera vector so that the camera is placed above the terrain.
            // Distance between the camera and the center point is kept constant.
            cameraToCenter[2] -= (minHeight - cameraHeight) / this._projectionScaler;

            const newDistToCamera = vec3.length(cameraToCenter);
            if (newDistToCamera === 0)
                return;

            vec3.scale(cameraToCenter, cameraToCenter, prevDistToCamera / newDistToCamera * this._projectionScaler);
            this._camera.position = [center.x - cameraToCenter[0], center.y - cameraToCenter[1], center.z * this._projectionScaler - cameraToCenter[2]];

            this._camera.orientation = orientationFromFrame(cameraToCenter, this._camera.up());
            this._updateStateFromCamera();
        }
    }

    _constrain() {
        if (!this.center || !this.width || !this.height || this._constraining) return;

        this._constraining = true;

        // alternate constraining for non-Mercator projections
        if (this.projection.isReprojectedInTileSpace) {
            const center = this.center;
            center.lat = clamp(center.lat, this.minLat, this.maxLat);
            if (this.maxBounds || !this.renderWorldCopies) center.lng = clamp(center.lng, this.minLng, this.maxLng);
            this.center = center;
            this._constraining = false;
            return;
        }

        const unmodified = this._unmodified;
        const {x, y} = this.point;
        let s = 0;
        let x2 = x;
        let y2 = y;
        const w2 = this.width / 2;
        const h2 = this.height / 2;

        const minY = this.worldMinY * this.scale;
        const maxY = this.worldMaxY * this.scale;
        if (y - h2 < minY) y2 = minY + h2;
        if (y + h2 > maxY) y2 = maxY - h2;
        if (maxY - minY < this.height) {
            s = Math.max(s, this.height / (maxY - minY));
            y2 = (maxY + minY) / 2;
        }

        if (this.maxBounds || !this._renderWorldCopies || !this.projection.wrap) {
            const minX = this.worldMinX * this.scale;
            const maxX = this.worldMaxX * this.scale;

            // Translate to positive positions with the map center in the center position.
            // This ensures that the map snaps to the correct edge.
            const shift = this.worldSize / 2 - (minX + maxX) / 2;
            x2 = (x + shift + this.worldSize) % this.worldSize - shift;

            if (x2 - w2 < minX) x2 = minX + w2;
            if (x2 + w2 > maxX) x2 = maxX - w2;
            if (maxX - minX < this.width) {
                s = Math.max(s, this.width / (maxX - minX));
                x2 = (maxX + minX) / 2;
            }
        }

        if (x2 !== x || y2 !== y) { // pan the map to fit the range
            this.center = this.unproject(new Point(x2, y2));
        }
        if (s) { // scale the map to fit the range
            this.zoom += this.scaleZoom(s);
        }

        this._constrainCameraAltitude();
        this._unmodified = unmodified;
        this._constraining = false;
    }

    /**
     * Returns the minimum zoom at which `this.width` can fit max longitude range
     * and `this.height` can fit max latitude range.
     *
     * @returns {number} The zoom value.
     */
    _minZoomForBounds(): number {
        let minZoom = Math.max(0, this.scaleZoom(this.height / (this.worldMaxY - this.worldMinY)));
        if (this.maxBounds) {
            minZoom = Math.max(minZoom, this.scaleZoom(this.width / (this.worldMaxX - this.worldMinX)));
        }
        return minZoom;
    }

    /**
     * Returns the maximum distance of the camera from the center of the bounds, such that
     * `this.width` can fit max longitude range and `this.height` can fit max latitude range.
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

        // Z-axis uses pixel coordinates when globe mode is enabled
        const pixelsPerMeter = this.pixelsPerMeter;

        this._projectionScaler = pixelsPerMeter / (mercatorZfromAltitude(1, this.center.lat) * this.worldSize);
        this.cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this.height * this._projectionScaler;

        this._updateCameraState();

        this._farZ = this.projection.farthestPixelDistance(this);

        // The larger the value of nearZ is
        // - the more depth precision is available for features (good)
        // - clipping starts appearing sooner when the camera is close to 3d features (bad)
        //
        // Smaller values worked well for mapbox-gl-js but deckgl was encountering precision issues
        // when rendering it's layers using custom layers. This value was experimentally chosen and
        // seems to solve z-fighting issues in deckgl while not clipping buildings too close to the camera.
        this._nearZ = this.height / 50;

        const zUnit = this.projection.zAxisUnit === "meters" ? pixelsPerMeter : 1.0;
        const worldToCamera = this._camera.getWorldToCamera(this.worldSize, zUnit);
        const cameraToClip = this._camera.getCameraToClipPerspective(this._fov, this.width / this.height, this._nearZ, this._farZ);

        // Apply center of perspective offset
        cameraToClip[8] = -offset.x * 2 / this.width;
        cameraToClip[9] = offset.y * 2 / this.height;

        let m = mat4.mul([], cameraToClip, worldToCamera);

        if (this.projection.isReprojectedInTileSpace) {
            // Projections undistort as you zoom in (shear, scale, rotate).
            // Apply the undistortion around the center of the map.
            const mc = this.locationCoordinate(this.center);
            const adjustments = mat4.identity([]);
            mat4.translate(adjustments, adjustments, [mc.x * this.worldSize, mc.y * this.worldSize, 0]);
            mat4.multiply(adjustments, adjustments, getProjectionAdjustments(this));
            mat4.translate(adjustments, adjustments, [-mc.x * this.worldSize, -mc.y * this.worldSize, 0]);
            mat4.multiply(m, m, adjustments);
            this.inverseAdjustmentMatrix = getProjectionAdjustmentInverted(this);
        } else {
            this.inverseAdjustmentMatrix = [1, 0, 0, 1];
        }

        // The mercatorMatrix can be used to transform points from mercator coordinates
        // ([0, 0] nw, [1, 1] se) to GL coordinates.
        this.mercatorMatrix = mat4.scale([], m, [this.worldSize, this.worldSize, this.worldSize / pixelsPerMeter, 1.0]);

        this.projMatrix = m;

        // For tile cover calculation, use inverted of base (non elevated) matrix
        // as tile elevations are in tile coordinates and relative to center elevation.
        this.invProjMatrix = mat4.invert(new Float64Array(16), this.projMatrix);

        const view = new Float32Array(16);
        mat4.identity(view);
        mat4.scale(view, view, [1, -1, 1]);
        mat4.rotateX(view, view, this._pitch);
        mat4.rotateZ(view, view, this.angle);

        const projection = mat4.perspective(new Float32Array(16), this._fov, this.width / this.height, this._nearZ, this._farZ);
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
        const point = this.point;
        const x = point.x, y = point.y;
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

        this._calcFogMatrices();
        this._distanceTileDataCache = {};

        // inverse matrix for conversion from screen coordinates to location
        m = mat4.invert(new Float64Array(16), this.pixelMatrix);
        if (!m) throw new Error("failed to invert matrix");
        this.pixelMatrixInverse = m;

        // globe matrix
        this.globeMatrix = this.projection.name === 'globe' ? calculateGlobeMatrix(this) : m;

        this._projMatrixCache = {};
        this._alignedProjMatrixCache = {};
        this._pixelsToTileUnitsCache = {};
    }

    _calcFogMatrices() {
        this._fogTileMatrixCache = {};

        const cameraWorldSize = this.cameraWorldSize;
        const cameraPixelsPerMeter = this.cameraPixelsPerMeter;
        const cameraPos = this._camera.position;

        // The mercator fog matrix encodes transformation necessary to transform a position to camera fog space (in meters):
        // translates p to camera origin and transforms it from pixels to meters. The windowScaleFactor is used to have a
        // consistent transformation across different window sizes.
        // - p = p - cameraOrigin
        // - p.xy = p.xy * cameraWorldSize * windowScaleFactor
        // - p.z  = p.z  * cameraPixelsPerMeter * windowScaleFactor
        const windowScaleFactor = 1 / this.height;
        const metersToPixel = [cameraWorldSize, cameraWorldSize, cameraPixelsPerMeter];
        vec3.scale(metersToPixel, metersToPixel, windowScaleFactor);
        vec3.scale(cameraPos, cameraPos, -1);
        vec3.multiply(cameraPos, cameraPos, metersToPixel);

        const m = mat4.create();
        mat4.translate(m, m, cameraPos);
        mat4.scale(m, m, metersToPixel);
        this.mercatorFogMatrix = m;

        // The worldToFogMatrix can be used for conversion from world coordinates to relative camera position in
        // units of fractions of the map height. Later composed with tile position to construct the fog tile matrix.
        this.worldToFogMatrix = this._camera.getWorldToCameraPosition(cameraWorldSize, cameraPixelsPerMeter, windowScaleFactor);
    }

    _computeCameraPosition(targetPixelsPerMeter: ?number): Vec3 {
        targetPixelsPerMeter = targetPixelsPerMeter || this.pixelsPerMeter;
        const pixelSpaceConversion = targetPixelsPerMeter / this.pixelsPerMeter;

        const dir = this._camera.forward();
        const center = this.point;

        // Compute camera position using the following vector math: camera.position = map.center - camera.forward * cameraToCenterDist
        // Camera distance to the center can be found in mercator units by subtracting the center elevation from
        // camera's zenith position (which can be deduced from the zoom level)
        const zoom = this._seaLevelZoom ? this._seaLevelZoom : this._zoom;
        const altitude = this._mercatorZfromZoom(zoom) * pixelSpaceConversion;
        const distance = altitude - targetPixelsPerMeter / this.worldSize * this._centerAltitude;

        return [
            center.x / this.worldSize - dir[0] * distance,
            center.y / this.worldSize - dir[1] * distance,
            targetPixelsPerMeter / this.worldSize * this._centerAltitude - dir[2] * distance
        ];
    }

    _updateCameraState() {
        if (!this.height) return;

        // Set camera orientation and move it to a proper distance from the map
        this._camera.setPitchBearing(this._pitch, this.angle);
        this._camera.position = this._computeCameraPosition();
    }

    /**
     * Apply a 3d translation to the camera position, but clamping it so that
     * it respects the maximum longitude and latitude range set.
     *
     * @param {vec3} translation The translation vector.
     */
    _translateCameraConstrained(translation: Vec3) {
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

        if (this.projection.wrap)
            this.center = this.center.wrap();
    }

    _updateStateFromCamera() {
        const position = this._camera.position;
        const dir = this._camera.forward();
        const {pitch, bearing} = this._camera.getPitchBearing();

        // Compute zoom from the distance between camera and terrain
        const centerAltitude = mercatorZfromAltitude(this._centerAltitude, this.center.lat) * this._projectionScaler;
        const minHeight = this._mercatorZfromZoom(this._maxZoom) * Math.cos(degToRad(this._maxPitch));
        const height = Math.max((position[2] - centerAltitude) / Math.cos(pitch), minHeight);
        const zoom = this._zoomFromMercatorZ(height);

        // Cast a ray towards the ground to find the center point
        vec3.scaleAndAdd(position, position, dir, height);

        this._pitch = clamp(pitch, degToRad(this.minPitch), degToRad(this.maxPitch));
        this.angle = wrap(bearing, -Math.PI, Math.PI);
        this._setZoom(clamp(zoom, this._minZoom, this._maxZoom));
        this._updateSeaLevelZoom();

        this._center = this.coordinateLocation(new MercatorCoordinate(position[0], position[1], position[2]));
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

    _minimumHeightOverTerrain(): number {
        // Determine minimum height for the camera over the terrain related to current zoom.
        // Values above than 2 allow max-pitch camera closer to e.g. top of the hill, exposing
        // drape raster overscale artifacts or cut terrain (see under it) as it gets clipped on
        // near plane. Returned value is in mercator coordinates.
        const MAX_DRAPE_OVERZOOM = 2;
        const zoom = Math.min((this._seaLevelZoom != null ? this._seaLevelZoom : this._zoom) + MAX_DRAPE_OVERZOOM, this._maxZoom);
        return this._mercatorZfromZoom(zoom);
    }

    _zoomFromMercatorZ(z: number): number {
        return this.scaleZoom(this.cameraToCenterDistance / (z * this.tileSize));
    }

    _terrainEnabled(): boolean {
        if (!this._elevation) return false;
        if (!this.projection.supportsTerrain) {
            warnOnce('Terrain is not yet supported with alternate projections. Use mercator to enable terrain.');
            return false;
        }
        return true;
    }

    // Check if any of the four corners are off the edge of the rendered map
    // This function will return `false` for all non-mercator projection
    anyCornerOffEdge(p0: Point, p1: Point): boolean {
        const minX = Math.min(p0.x, p1.x);
        const maxX = Math.max(p0.x, p1.x);
        const minY = Math.min(p0.y, p1.y);
        const maxY = Math.max(p0.y, p1.y);

        const horizon = this.horizonLineFromTop(false);
        if (minY < horizon) return true;

        if (this.projection.name !== 'mercator') {
            return false;
        }

        const min = new Point(minX, minY);
        const max = new Point(maxX, maxY);

        const corners = [
            min, max,
            new Point(minX, maxY),
            new Point(maxX, minY),
        ];

        const minWX = (this.renderWorldCopies) ? -NUM_WORLD_COPIES : 0;
        const maxWX = (this.renderWorldCopies) ? 1 + NUM_WORLD_COPIES : 1;
        const minWY = 0;
        const maxWY = 1;

        for (const corner of corners) {
            const rayIntersection = this.pointRayIntersection(corner);
            // Point is above the horizon
            if (rayIntersection.t < 0) {
                return true;
            }
            // Point is off the bondaries of the map
            const coordinate = this.rayIntersectionCoordinate(rayIntersection);
            if (coordinate.x < minWX || coordinate.y < minWY ||
                coordinate.x > maxWX || coordinate.y > maxWY) {
                return true;
            }
        }

        return false;
    }

    // Checks the four corners of the frustum to see if they lie in the map's quad.
    //
    isHorizonVisible(): boolean {

        // we consider the horizon as visible if the angle between
        // a the top plane of the frustum and the map plane is smaller than this threshold.
        const horizonAngleEpsilon = 2;
        if (this.pitch + radToDeg(this.fovAboveCenter) > (90 - horizonAngleEpsilon)) {
            return true;
        }

        return this.anyCornerOffEdge(new Point(0, 0), new Point(this.width, this.height));
    }

    /**
     * Converts a zoom delta value into a physical distance travelled in web mercator coordinates.
     *
     * @param {vec3} center Destination mercator point of the movement.
     * @param {number} zoomDelta Change in the zoom value.
     * @returns {number} The distance in mercator coordinates.
     */
    zoomDeltaToMovement(center: Vec3, zoomDelta: number): number {
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
    getCameraPoint(): Point {
        const pitch = this._pitch;
        const yOffset = Math.tan(pitch) * (this.cameraToCenterDistance || 1);
        return this.centerPoint.add(new Point(0, yOffset));
    }
}

export default Transform;
