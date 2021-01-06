// @flow
import type Transform from '../geo/transform';
import type MercatorCoordinate from '../geo/mercator_coordinate';
import {distanceToLine} from '../util/util';
import Point from '@mapbox/point-geometry';
import {mat4, vec3} from 'gl-matrix';
import {array as interpolate} from '../style-spec/util/interpolate';

const NEAR_THRESHOLD_MAX = 1 / Math.cos(Math.PI / 4);
const NEAR_THRESHOLD_MIN = 0.1;

export class HeightmapCascade {
    nearCascadeMatrix: Float64Array;
    farCascadeMatrix: Float64Array;
    needsFarCascade: boolean;

    constructor() {
        this.nearCascadeMatrix = new Float64Array(16);
        this.farCascadeMatrix = new Float64Array(16);
        this.needsFarCascade = false;

    }

    calculateMatrices(transform: Transform) {
        const {x, y} = transform.point;
        const worldSize = transform.worldSize;
        const toPixels = (coord: MercatorCoordinate): vec3 => [coord.x * worldSize, coord.y * worldSize, 0];

        const horizon = transform.horizonLineFromTop();
        const topLeft = toPixels(transform.pointCoordinate(new Point(0, horizon)));
        const topRight = toPixels(transform.pointCoordinate(new Point(transform.width, horizon)));
        const btmLeft = toPixels(transform.pointCoordinate(new Point(0, transform.height)));
        const btmRight = toPixels(transform.pointCoordinate(new Point(transform.width, transform.height)));

        const top = distanceToLine(topLeft, topRight, [0, 0, 0]);
        const btm = distanceToLine(btmLeft, btmRight, [0, 0, 0]);

        const nearCascadeHeight = transform.height * NEAR_THRESHOLD_MAX;
        const nearCascadeExtent = Math.max(Math.min(nearCascadeHeight / Math.abs(btm - top), 1), NEAR_THRESHOLD_MIN);
        this.needsFarCascade = nearCascadeExtent < 1;

        const midLeft = interpolate(btmLeft, topLeft, nearCascadeExtent);
        const midRight = interpolate(btmRight, topRight, nearCascadeExtent);
        this._matrixFromTrapezoid(this.nearCascadeMatrix, transform.angle, midLeft, midRight, btmLeft, btmRight);

        if (this.needsFarCascade) {
            this._matrixFromTrapezoid(this.farCascadeMatrix, transform.angle, topLeft, topRight, midLeft, midRight);
        }
    }

    _matrixFromTrapezoid(out: Float64Array, angle: Number, topLeft: vec3, topRight: vec3, btmLeft: vec3, btmRight: vec3) {
        const center = vec3.add([], [0, 0, 0], topLeft);
        vec3.add(center, center, topRight);
        vec3.add(center, center, btmLeft);
        vec3.add(center, center, btmRight);
        vec3.scale(center, center, 1 / 4);

        const n = vec3.sub([], topRight, topLeft);
        vec3.normalize(n, n);

        const top = Math.abs(distanceToLine(topLeft, topRight, center));
        const btm = Math.abs(distanceToLine(btmLeft, btmRight, center));
        const left = Math.abs(vec3.dot(vec3.sub([], center, topLeft), n));
        const right = Math.abs(vec3.dot(vec3.sub([], center, topRight), n));

        const m = mat4.ortho(out, -left, right, -btm, top, 0, 1);
        mat4.scale(m, m, [1, -1, 1]);
        mat4.rotateZ(m, m, angle);

        vec3.scale(center, center, -1);
        mat4.translate(m, m, center);
    }
}