// @flow
import type Transform from '../transform.js';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id.js';
import {mat4, vec3} from 'gl-matrix';
import MercatorCoordinate from '../mercator_coordinate.js';
import Point from '@mapbox/point-geometry';
import EXTENT from '../../data/extent.js';

export default class FlatTileTransform {
    _tr: Transform;
    _worldSize: number;
    _identity: Float64Array;

    constructor(tr: Transform, worldSize: number) {
        this._tr = tr;
        this._worldSize = worldSize;
        // eslint-disable-next-line no-warning-comments
        // TODO: Cache this elsewhere?
        this._identity = mat4.identity(new Float64Array(16));
    }

    createLabelPlaneMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits): mat4 {
        const m = mat4.create();
        if (pitchWithMap) {
            mat4.scale(m, m, [1 / pixelsToTileUnits, 1 / pixelsToTileUnits, 1]);
            if (!rotateWithMap) {
                mat4.rotateZ(m, m, this._tr.angle);
            }
        } else {
            mat4.multiply(m, this._tr.labelPlaneMatrix, posMatrix);
        }
        return m;
    }

    createGlCoordMatrix(posMatrix: mat4, tileID: CanonicalTileID, pitchWithMap: boolean, rotateWithMap: boolean, pixelsToTileUnits): mat4 {
        if (pitchWithMap) {
            const m = mat4.clone(posMatrix);
            mat4.scale(m, m, [pixelsToTileUnits, pixelsToTileUnits, 1]);
            if (!rotateWithMap) {
                mat4.rotateZ(m, m, -this._tr.angle);
            }
            return m;
        } else {
            return this._tr.glCoordMatrix;
        }
    }

    createInversionMatrix(): mat4 {
        return this._identity;
    }

    createTileMatrix(id: UnwrappedTileID): mat4 {
        const canonical = id.canonical;
        const zoomScale = Math.pow(2, canonical.z);
        const scale = this._worldSize / zoomScale;
        const unwrappedX = canonical.x + zoomScale * id.wrap;

        const posMatrix = mat4.identity(new Float64Array(16));
        mat4.translate(posMatrix, posMatrix, [unwrappedX * scale, canonical.y * scale, 0]);
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
