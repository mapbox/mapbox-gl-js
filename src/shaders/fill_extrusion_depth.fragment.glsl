varying highp float v_depth;

// pack 2 16 bits floats
highp vec4 pack_depth_vsm(highp float ndc_z) {
    highp float depth = ndc_z * 0.5 + 0.5;
    float moment2 = depth * depth;

    // Adjusting moments (this is sort of bias per pixel) using partial derivative
    float dx = dFdx(depth);
    float dy = dFdy(depth);
    moment2 += 0.25*(dx*dx+dy*dy) ;

    const highp vec4 bit_shift = vec4(255.0, 1.0, 255.0, 1.0);
    const highp vec4 bit_mask  = vec4(0.0, 1.0 / 255.0, 0.0, 1.0 / 255.0);
    highp vec4 res = fract(vec4(depth, depth, moment2, moment2) * bit_shift);
    res -= res.xxzz * bit_mask;
    return res;
}

// pack 2 32 bits floats
highp vec4 depth_vsm(highp float ndc_z) {
    highp float depth = ndc_z * 0.5 + 0.5;
    float moment2 = depth * depth;

    // Adjusting moments (this is sort of bias per pixel) using partial derivative
    float dx = dFdx(depth);
    float dy = dFdy(depth);
    moment2 += 0.25*(dx*dx+dy*dy) ;
    return vec4(depth, moment2, 0.0, 0.0);
}


// Applies exponential warp to shadow map depth, input depth should be in [0, 1]
vec2 warpDepth(float depth, vec2 exponents)
{
    // Rescale depth into [-1, 1]
    depth = 2.0 * depth - 1.0;
    float pos =  exp( exponents.x * depth);
    float neg = -exp(-exponents.y * depth);
    return vec2(pos, neg);
}

highp vec4 pack_depth_evsm(highp float ndc_z) {
    highp float depth = ndc_z * 0.5 + 0.5;
    const float PositiveExponent = 40.0;
    const float NegativeExponent = 5.0;

    vec2 exponents = vec2(PositiveExponent, NegativeExponent);
    vec2 vsmDepth = warpDepth(depth, exponents);

    vec2 moment2 = vsmDepth * vsmDepth;

    highp vec4 res = vec4(vsmDepth.x, vsmDepth.y, moment2.x, moment2.y);
    return res;
}


void main() {
    gl_FragColor = pack_depth_evsm(v_depth);
}
