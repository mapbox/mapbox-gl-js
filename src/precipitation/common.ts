import {earthRadius} from '../geo/lng_lat.js';
import {degToRad, clamp} from '../util/util.js';
import {mulberry32} from '../style-spec/util/random';
import {vec3, quat, mat4} from 'gl-matrix';
import {Vignette} from './vignette';

import type Transform from "../geo/transform";
import type IndexBuffer from '../gl/index_buffer';
import type VertexBuffer from '../gl/vertex_buffer';
import type Painter from '../render/painter';

export class Movement {
    _offsetXPrev: number | undefined;
    _offsetYPrev: number | undefined;
    _elevationPrev: number | undefined;

    _accumulatedOffsetX: number;
    _accumulatedOffsetY: number;
    _accumulatedElevation: number;

    constructor() {
        this._accumulatedOffsetX = 0;
        this._accumulatedOffsetY = 0;
        this._accumulatedElevation = 0;
    }

    update(tr: Transform, ppmScaleFactor: number) {
        const options = tr.getFreeCameraOptions();
        const cameraMercatorPos = options.position;

        const elevation = cameraMercatorPos.toAltitude();

        const latLng = cameraMercatorPos.toLngLat();
        const lng = degToRad(latLng.lng);
        const lat = degToRad(latLng.lat);

        // Mercator meters
        const ppmScale = tr.pixelsPerMeter / ppmScaleFactor;

        const offsetXCur = lng * earthRadius;
        const offsetYCur = earthRadius * Math.log(Math.tan(Math.PI / 4 + lat / 2));

        if (this._offsetXPrev === undefined) {
            this._offsetXPrev = 0;
            this._offsetYPrev = 0;
            this._elevationPrev = 0;

            this._accumulatedOffsetX = 0;
            this._accumulatedOffsetY = 0;
            this._accumulatedElevation = 0;
        } else {
            const deltaX = -this._offsetXPrev + offsetXCur;
            const deltaY = -this._offsetYPrev + offsetYCur;
            const deltaE = -this._elevationPrev + elevation;

            this._accumulatedOffsetX += deltaX * ppmScale;
            this._accumulatedOffsetY += deltaY * ppmScale;
            this._accumulatedElevation += deltaE * ppmScale;

            this._offsetXPrev = offsetXCur;
            this._offsetYPrev = offsetYCur;
            this._elevationPrev = elevation;
        }
    }

    getPosition(): vec3 {
        return [this._accumulatedOffsetX, this._accumulatedOffsetY, this._accumulatedElevation];
    }
}

export function boxWrap(unwrappedPos: vec3, boxSize: number): vec3 {
    const wrappedOffsetX = unwrappedPos[0] - Math.floor(unwrappedPos[0] / boxSize) * boxSize;
    const wrappedOffsetY = unwrappedPos[1] - Math.floor(unwrappedPos[1] / boxSize) * boxSize;
    const wrappedOffsetZ = unwrappedPos[2] - Math.floor(unwrappedPos[2] / boxSize) * boxSize;

    return [-wrappedOffsetX, -wrappedOffsetY, -wrappedOffsetZ];

}

export function generateUniformDistributedPointsInsideCube(pointsCount: number): Array<vec3> {
    const sRand = mulberry32(1323123451230);

    const points: Array<vec3> = [];
    for (let i = 0; i < pointsCount; ++i) {
        const vx = -1 + 2 * sRand();
        const vy = -1 + 2 * sRand();
        const vz = -1 + 2 * sRand();

        points.push(vec3.fromValues(vx, vy, vz));
    }

    return points;
}

export function lerpClamp(a: number, b: number, t1: number, t2: number, tMid: number) {
    const t = clamp((tMid - t1) / (t2 - t1), 0, 1);
    return (1 - t) * a + t * b;
}

class DrawParams {
    projectionMatrix: mat4;
    modelviewMatrix: mat4;
}

export class PrecipitationBase {
    particlesVx: VertexBuffer | null | undefined;
    particlesIdx: IndexBuffer | null | undefined;
    particlesCount: number;

    _movement: Movement;

    _prevTime: number;
    _accumulatedTimeFromStart: number;

    _vignette: Vignette;

    _ppmScaleFactor: number;

    constructor(ppmScaleFactor: number) {
        this._movement = new Movement();

        this._accumulatedTimeFromStart = 0;
        this._prevTime = Date.now() / 1000;

        this._vignette = new Vignette();

        this._ppmScaleFactor = ppmScaleFactor;
    }

    destroy() {
        if (this.particlesVx) {
            this.particlesVx.destroy();
        }

        if (this.particlesIdx) {
            this.particlesIdx.destroy();
        }

        if (this._vignette) {
            this._vignette.destroy();
        }
    }

    updateOnRender(painter: Painter, timeFactor: number) : DrawParams {
        const tr = painter.transform;

        this._movement.update(tr, this._ppmScaleFactor);

        const projectionMatrix = tr.starsProjMatrix;

        const orientation = quat.identity([] as unknown as quat);

        quat.rotateX(orientation, orientation, degToRad(90) - tr._pitch);
        quat.rotateZ(orientation, orientation, -tr.angle);

        const rotationMatrix = mat4.fromQuat(new Float32Array(16), orientation);

        const swapAxesT = mat4.fromValues(1, 0, 0, 0,
            0, 0, 1, 0,
            0, -1, 0, 0,
            0, 0, 0, 1);
        const swapAxes = mat4.transpose([] as unknown as mat4, swapAxesT);

        const modelviewMatrix = mat4.multiply([] as unknown as mat4, swapAxes, rotationMatrix);

        const curTime = Date.now() / 1000;
        this._accumulatedTimeFromStart += (curTime - this._prevTime) * timeFactor;
        this._prevTime = curTime;

        return {projectionMatrix, modelviewMatrix};
    }
}
