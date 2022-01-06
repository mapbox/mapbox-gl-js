// @flow
import type Transform from '../transform.js';
import {UnwrappedTileID} from '../../source/tile_id.js';
import {mat4, vec3} from 'gl-matrix';
import MercatorCoordinate from '../mercator_coordinate.js';
import Point from '@mapbox/point-geometry';
import EXTENT from '../../data/extent.js';
import tileTransform from './tile_transform.js';

const identity = mat4.identity(new Float64Array(16));

export default class FlatTileTransform {
    _tr: Transform;
    _worldSize: number;
    _identity: Float64Array;

    constructor(tr: Transform, worldSize: number) {
        this._tr = tr;
        this._worldSize = worldSize;
    }

    createInversionMatrix(): mat4 {
        return identity;
    }

    createTileMatrix(id: UnwrappedTileID): mat4 {
        let scale, scaledX, scaledY;
        const canonical = id.canonical;
        const posMatrix = mat4.identity(new Float64Array(16));
        const projection = this._tr.projection;

        if (projection.isReprojectedInTileSpace) {
            const cs = tileTransform(canonical, projection);
            scale = 1;
            scaledX = cs.x + id.wrap * cs.scale;
            scaledY = cs.y;
            mat4.scale(posMatrix, posMatrix, [scale / cs.scale, scale / cs.scale, this._tr.pixelsPerMeter / this._worldSize]);
        } else {
            scale = this._worldSize / this._tr.zoomScale(canonical.z);
            const unwrappedX = canonical.x + Math.pow(2, canonical.z) * id.wrap;
            scaledX = unwrappedX * scale;
            scaledY = canonical.y * scale;
        }

        mat4.translate(posMatrix, posMatrix, [scaledX, scaledY, 0]);
        mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1]);

        return posMatrix;
    }

    pointCoordinate(x: number, y: number, z?: number): MercatorCoordinate {
        const horizonOffset = this._tr.horizonLineFromTop(false);
        const clamped = new Point(x, Math.max(horizonOffset, y));
        return this._tr.rayIntersectionCoordinate(this._tr.pointRayIntersection(clamped, z));
    }

    upVector(): vec3 {
        return [0, 0, 1];
    }

    upVectorScale(): number {
        return 1;
    }
}
