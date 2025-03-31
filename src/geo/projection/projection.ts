import LngLat from '../lng_lat';
import {mercatorZfromAltitude} from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {farthestPixelDistanceOnPlane} from './far_z';
import {mat4} from 'gl-matrix';
import EXTENT from '../../style-spec/data/extent';
import tileTransform from './tile_transform';

import type {vec3} from 'gl-matrix';
import type Transform from '../../geo/transform';
import type MercatorCoordinate from '../mercator_coordinate';
import type {ProjectionSpecification} from '../../style-spec/types';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';

export type ProjectedPoint = {
    x: number;
    y: number;
    z: number;
};

export type ElevationScale = {
    // `metersToTile` converts meters to units used to describe elevation in tile space.
    // Default units in mercator space are x & y: [0, 8192] and z: meters
    metersToTile: number;
};

const identity = mat4.identity(new Float32Array(16));

export default class Projection {
    name: string;
    wrap: boolean;
    conic: boolean;
    requiresDraping: boolean;
    supportsWorldCopies: boolean;
    supportsTerrain: boolean;
    supportsFog: boolean;
    supportsFreeCamera: boolean;
    zAxisUnit: 'meters' | 'pixels';
    isReprojectedInTileSpace: boolean;
    center: [number, number];
    range: [number, number] | null | undefined;
    parallels: [number, number] | null | undefined;
    unsupportedLayers: Array<string>;
    spec: ProjectionSpecification;

    constructor(options: ProjectionSpecification) {
        this.spec = options;
        this.name = options.name;
        this.wrap = false;
        this.requiresDraping = false;
        this.supportsWorldCopies = false;
        this.supportsTerrain = false;
        this.supportsFog = false;
        this.supportsFreeCamera = false;
        this.zAxisUnit = 'meters';
        this.isReprojectedInTileSpace = true;
        this.unsupportedLayers = ['custom'];
        this.center = [0, 0];
        this.range = [3.5, 7];
    }

    project(lng: number, lat: number): ProjectedPoint { // eslint-disable-line
        return {x: 0, y: 0, z: 0}; // overriden in subclasses
    }

    unproject(x: number, y: number): LngLat { // eslint-disable-line
        return new LngLat(0, 0); // overriden in subclasses
    }

    projectTilePoint(x: number, y: number, _: CanonicalTileID): ProjectedPoint {
        return {x, y, z: 0};
    }

    locationPoint(tr: Transform, lngLat: LngLat, altitude?: number, terrain: boolean = true): Point {
        return tr._coordinatePoint(tr.locationCoordinate(lngLat, altitude), terrain);
    }

    pixelsPerMeter(lat: number, worldSize: number): number {
        return mercatorZfromAltitude(1, lat) * worldSize;
    }

    // pixels-per-meter is used to describe relation between real world and pixel distances.
    // `pixelSpaceConversion` can be used to convert the ratio from mercator projection to
    // the currently active projection.
    //
    // `pixelSpaceConversion` is useful for converting between pixel spaces where some logic
    // expects mercator pixels, such as raycasting where the scale is expected to be in
    // mercator pixels.
    pixelSpaceConversion(lat: number, worldSize: number, interpolationT: number): number { // eslint-disable-line
        return 1.0;
    }

    farthestPixelDistance(tr: Transform): number {
        return farthestPixelDistanceOnPlane(tr, tr.pixelsPerMeter);
    }

    pointCoordinate(tr: Transform, x: number, y: number, z: number): MercatorCoordinate {
        const horizonOffset = tr.horizonLineFromTop(false);
        const clamped = new Point(x, Math.max(horizonOffset, y));
        return tr.rayIntersectionCoordinate(tr.pointRayIntersection(clamped, z));
    }

    pointCoordinate3D(tr: Transform, x: number, y: number): vec3 | null | undefined {
        const p = new Point(x, y);
        if (tr.elevation) {
            return tr.elevation.pointCoordinate(p) as vec3;
        } else {
            const mc = this.pointCoordinate(tr, p.x, p.y, 0);
            return [mc.x, mc.y, mc.z];
        }
    }

    isPointAboveHorizon(tr: Transform, p: Point): boolean {
        if (tr.elevation && tr.elevation.visibleDemTiles.length) {
            const raycastOnTerrain = this.pointCoordinate3D(tr, p.x, p.y);
            return !raycastOnTerrain;
        }
        const horizon = tr.horizonLineFromTop();
        return p.y < horizon;
    }

    createInversionMatrix(tr: Transform, id: CanonicalTileID): mat4 {
        return identity;
    }

    createTileMatrix(tr: Transform, worldSize: number, id: UnwrappedTileID): mat4 {
        let scale, scaledX, scaledY;
        const canonical = id.canonical;
        const posMatrix = mat4.identity(new Float64Array(16) as unknown as mat4);

        if (this.isReprojectedInTileSpace) {
            const cs = tileTransform(canonical, this);
            scale = 1;
            scaledX = cs.x + id.wrap * cs.scale;
            scaledY = cs.y;
            mat4.scale(posMatrix, posMatrix, [scale / cs.scale, scale / cs.scale, tr.pixelsPerMeter / worldSize]);
        } else {
            scale = worldSize / tr.zoomScale(canonical.z);
            const unwrappedX = canonical.x + Math.pow(2, canonical.z) * id.wrap;
            scaledX = unwrappedX * scale;
            scaledY = canonical.y * scale;
        }

        mat4.translate(posMatrix, posMatrix, [scaledX, scaledY, 0]);
        mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1]);

        return posMatrix;
    }

    upVector(id: CanonicalTileID, x: number, y: number): [number, number, number] {
        return [0, 0, 1];
    }

    upVectorScale(id: CanonicalTileID, latitude: number, worldSize: number): ElevationScale {
        return {metersToTile: 1};
    }
}
