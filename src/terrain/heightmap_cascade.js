// @flow
import type Transform from '../geo/transform';
import type MercatorCoordinate from '../geo/mercator_coordinate';
import {distanceToLine} from '../util/util';
import Point from '@mapbox/point-geometry';
import {mat4, vec3} from 'gl-matrix';

export class HeightmapCascade {
    // index 0 -> near cascade
    // index 1 -> far cascade
    matrices: [Float64Array, Float64Array];

    constructor() {
        this.matrices = [
            new Float64Array(16),
            new Float64Array(16)
        ];
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

    }

    _matrixFromTrapezoid(out: Float64Array, angle: Number, topLeft: vec3, topRight: vec3, btmLeft: vec3, btmRight: vec3) {
        const center = vec3.add([], topLeft);
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