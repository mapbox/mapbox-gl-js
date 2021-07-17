export { placeGlyph, planSegment };

import {vec2} from 'gl-matrix';

function vec2quad(out, a, b, c, t) {
    const q = t * t - 2 * t + 1;
    const r = 2 * t * (1 - t);
    const s = t * t;
    out[0] = a[0] * q + b[0] * r + c[0] * s;
    out[1] = a[1] * q + b[1] * r + c[1] * s;
    return out;
}

function vec2quadDeriv(out, a, b, c, t) {
    const q = t - 1;
    const r = 1 - 2 * t;
    out[0] = 2 * (a[0] * q + b[0] * r + c[0] * t);
    out[1] = 2 * (a[1] * q + b[1] * r + c[1] * t);
    return out;
}

function vec2angle(a) {
    return Math.atan2(a[1], a[0]);
}

function vec2cross(a, b) {
    return a[0] * b[1] - a[1] * b[0];
}

function vec2perp(out, a) {
    out[0] = -a[1];
    out[1] = a[0];
    return out;
}

function planSegment(r01, r12, offset, radius) {
    // Compute cachable information. This could be cached. Some sections can
    // be omitted if there is no text offset. Function calls can be inlined.

    // Current segment
    const l01 = vec2.length(r01);
    const t01 = vec2.scale([], r01, 1 / l01);

    if (!r12) {
        // Termination criteria to finish out the current segment and then halt
        return { s0: l01, s1: l01, t01, t12: t01, currentSegmentDistance: NaN };
    }

    // Tangent of next segment
    const t12 = vec2.normalize([], r12);

    // Extension past the end of the segment, due to the miter
    const cosTheta = vec2.dot(t01, t12);
    const sinTheta = vec2cross(t12, t01);
    const c = 1 / (1 + cosTheta);
    const extension = sinTheta * c * offset;

    // Miter vector (point relative to corner where offset segments meet)
    const miter = vec2perp([], vec2.scale([], vec2.add([], t01, t12), c));

    // Length of rounding (does not depend on text offset!)
    const round = Math.max(
        //Math.abs(extension), // dependence on text offset when radius is large??
        Math.abs(vec2.dot(t01, miter) * radius)
    );

    // Stop, relative to p0, at which to start the quadratic arc
    const s0 = l01 + extension - round;

    // Parameterization scale factor of arc, to keep kerning roughly constant. Approximate
    // and plucked out of the sky. Over-stretches a bit, which is nice so characters don't
    // run into each other. It's not a very good estimate, but we already avoid paths with
    // sharp corners, so why overthink it?
    const tScale = Math.max(0.7, 1 / vec2.length(miter));

    // Stop, relative to p0, at which to end quadratic arc
    const s1 = s0 + 2 * round * tScale;

    // Offset, after passing stop1, so that we end up at the correct position on the next arc
    const currentSegmentDistance = s1 + extension - round;

    return { r01, r12, s0, s1, round, t01, t12, currentSegmentDistance, miter, offset };
}

function placeGlyph(plan, arcPosition) {
    const { r01, r12, s0, s1, round, t01, t12, currentSegmentDistance, miter, offset } = plan;

    if (arcPosition < s0) {
        // Simply offset and place along the line segment
        const out = vec2.scale([], [-t01[1], t01[0]], offset);
        vec2.scaleAndAdd(out, out, t01, arcPosition);
        const angle = Math.atan2(t01[1], t01[0]);
        return { x: out[0], y: out[1], angle };
    } else {//if (arcPosition < s1) {
        // Compute three quadratic arc control points
        const pb = vec2.scaleAndAdd([], r01, miter, offset);
        const pa = vec2.scaleAndAdd([], pb, t01, -round);
        const pc = vec2.scaleAndAdd([], pb, t12, round);

        // Arc parameter, using the
        const t = (arcPosition - s0) / (s1 - s0);

        const pos = vec2quad([], pa, pb, pc, t);
        const angle = vec2angle(vec2quadDeriv([], pa, pb, pc, t));
        return { x: pos[0], y: pos[1], angle };
    }
}
