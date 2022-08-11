precision highp float;

#ifdef RENDER_SHADOWS

uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec2 u_cascade_distances;
uniform highp vec3 u_shadow_direction;
uniform highp vec3 u_shadow_bias;

highp float shadow_sample_1(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_1, uv)), compare);
}

highp float shadow_sample_0(highp vec2 uv, highp float compare) {
    return step(unpack_depth(texture2D(u_shadowmap_0, uv)), compare);
}

highp float shadow_occlusion_1(highp vec4 pos, highp float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    highp float compare1 = min(pos.z, 0.999) - bias;
    return shadow_sample_1(pos.xy, compare1);
}

highp float shadow_occlusion_0(highp vec4 pos, highp float bias) {
    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    highp float compare0 = min(pos.z, 0.999) - bias;
    highp vec2 uv = pos.xy;

    highp vec2 texel = uv / u_texel_size - vec2(1.5);
    highp vec2 f = fract(texel);

    highp float s = u_texel_size;

    // Perform brute force percentage-closer filtering with a 4x4 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel, i.e. `weight = clamp(kernel, texel.bounds).area / texel.area`
    highp vec2 uv00 = (texel - f + 0.5) * s;
    highp vec2 uv10 = uv00 + vec2(1.0 * s, 0);
    highp vec2 uv20 = uv00 + vec2(2.0 * s, 0);
    highp vec2 uv30 = uv00 + vec2(3.0 * s, 0);

    highp vec2 uv01 = uv00 + vec2(0.0, 1.0 * s);
    highp vec2 uv11 = uv01 + vec2(1.0 * s, 0);
    highp vec2 uv21 = uv01 + vec2(2.0 * s, 0);
    highp vec2 uv31 = uv01 + vec2(3.0 * s, 0);

    highp vec2 uv02 = uv01 + vec2(0.0, 1.0 * s);
    highp vec2 uv12 = uv02 + vec2(1.0 * s, 0);
    highp vec2 uv22 = uv02 + vec2(2.0 * s, 0);
    highp vec2 uv32 = uv02 + vec2(3.0 * s, 0);

    highp vec2 uv03 = uv02 + vec2(0.0, 1.0 * s);
    highp vec2 uv13 = uv03 + vec2(1.0 * s, 0);
    highp vec2 uv23 = uv03 + vec2(2.0 * s, 0);
    highp vec2 uv33 = uv03 + vec2(3.0 * s, 0);

    highp float o00 = shadow_sample_0(uv00, compare0);
    highp float o10 = shadow_sample_0(uv10, compare0);
    highp float o20 = shadow_sample_0(uv20, compare0);
    highp float o30 = shadow_sample_0(uv30, compare0);

    highp float o01 = shadow_sample_0(uv01, compare0);
    highp float o11 = shadow_sample_0(uv11, compare0);
    highp float o21 = shadow_sample_0(uv21, compare0);
    highp float o31 = shadow_sample_0(uv31, compare0);

    highp float o02 = shadow_sample_0(uv02, compare0);
    highp float o12 = shadow_sample_0(uv12, compare0);
    highp float o22 = shadow_sample_0(uv22, compare0);
    highp float o32 = shadow_sample_0(uv32, compare0);

    highp float o03 = shadow_sample_0(uv03, compare0);
    highp float o13 = shadow_sample_0(uv13, compare0);
    highp float o23 = shadow_sample_0(uv23, compare0);
    highp float o33 = shadow_sample_0(uv33, compare0);

    // Edge tap smoothing
    highp float value = 
        (1.0 - f.x) * (1.0 - f.y) * o00 +
        (1.0 - f.y) * (o10 + o20) +
        f.x * (1.0 - f.y) * o30 +
        (1.0 - f.x) * (o01 + o02) +
        f.x * (o31 + o32) +
        (1.0 - f.x) * f.y * o03 +
        f.y * (o13 + o23) +
        f.x * f.x * o33 +
        o11 + o21 + o12 + o22;

    return clamp(value / 9.0, 0.0, 1.0);
}

// float shadow_occlusion(highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth, highp float bias) {
//     const float cascadeFadeRange = 0.05;
//     const float endFadeRange = 0.25;

//     float occlusion = 0.0;
//     if (view_depth < u_cascade_distances.x) {
//         occlusion = shadow_occlusion_0(light_view_pos0, bias);
//     }
//     if (view_depth > u_cascade_distances.x * (1.0 - cascadeFadeRange) && view_depth < u_cascade_distances.y) {
//         float occlusion1 = shadow_occlusion_1(light_view_pos1, bias);

//         // If view_depth is within cascade 0 depth, mix the results
//         occlusion = (view_depth >= u_cascade_distances.x) ? occlusion1 :
//             mix(occlusion1, occlusion, (u_cascade_distances.x - view_depth) / (u_cascade_distances.x * cascadeFadeRange));
        
//         // If view_depth is within end fade range, fade out
//         if (view_depth > u_cascade_distances.y * (1.0 - endFadeRange)) {
//             occlusion *= (u_cascade_distances.y - view_depth) / (u_cascade_distances.y * endFadeRange);
//         }
//     }

//     return occlusion;
// }


highp vec2 unpack_depth_vsm(highp vec4 moments){
    const vec4 bit_shift = vec4(1.0 / 255.0, 1.0, 1.0 / 255.0, 1.0);
    moments*= bit_shift;
    return vec2((moments.x + moments.y), (moments.z+moments.w));
}

const float MIN_VARIANCE = 0.000002;
const float LIGHT_BLEEDING_DROPPER = 0.79;

highp float vsm(highp vec4 pos, sampler2D shadowMap){
    pos.xyz /= pos.w;
    pos.xyz = pos.xyz * 0.5 + 0.5;
    vec2 moments = unpack_depth_vsm(texture2D(shadowMap, pos.xy));

    // vec4 moments = texture2D(shadowMap, pos.xy);

    float distance =  pos.z;

   // Surface is fully lit. as the current fragment is before the light occluder
    if (distance <= moments.x)
        return 1.0 ;
    // The fragment is either in shadow or penumbra. We now use chebyshev's upperBound to check
    // How likely this pixel is to be lit (p_max)
    float variance = moments.y - (moments.x * moments.x);
    variance = max(variance, MIN_VARIANCE);

    float d = distance - moments.x;
    float p_max = variance / (variance + d*d);

    // float shade = smoothstep(0.20, 1.0, p_max);
    float shade = clamp( ((p_max - LIGHT_BLEEDING_DROPPER) / (1.0 - LIGHT_BLEEDING_DROPPER)), 0.0, 1.0);

    return shade;
}

// Applies exponential warp to shadow map depth, input depth should be in [0, 1]
vec2 warp_depth(float depth, vec2 exponents)
{
    // Rescale depth into [-1, 1]
    depth = 2.0 * depth - 1.0;
    float pos =  exp( exponents.x * depth);
    float neg = -exp(-exponents.y * depth);
    return vec2(pos, neg);
}


float chebyshev(vec2 moments, float mean, float minVariance)
{
    // Compute variance
    float variance = moments.y - (moments.x * moments.x);
    variance = max(variance, minVariance);

    // Compute probabilistic upper bound
    float d = mean - moments.x;
    float pMax = variance / (variance + (d * d));

    // pMax = smoothstep(LIGHT_BLEEDING_DROPPER, 1.0, pMax);
    clamp( ((pMax - LIGHT_BLEEDING_DROPPER) / (1.0 - LIGHT_BLEEDING_DROPPER)), 0.0, 1.0);

    // One-tailed Chebyshev
    return (mean <= moments.x ? 1.0 : pMax);
}


highp float evsm(highp vec4 pos, sampler2D shadowMap){
    pos.xyz /= pos.w;
    pos.xyz = pos.xyz * 0.5 + 0.5;
    vec4 moments = texture2D(shadowMap, pos.xy);

    const float PositiveExponent = 40.0;
    const float NegativeExponent = 5.0;

    vec2 exponents = vec2(PositiveExponent, NegativeExponent);
    vec2 warpedDepth = warp_depth(pos.z, exponents);

    // Derivative of warping at depth
    vec2 depthScale = 0.01 * exponents * warpedDepth;
    vec2 minVariance = depthScale * depthScale;

    float posContrib = chebyshev(moments.xz, warpedDepth.x, minVariance.x);
    float negContrib = chebyshev(moments.yw, warpedDepth.y, minVariance.y);
    return min(posContrib, negContrib);
}




float shadow_occlusion(highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth, highp float bias) {
    const float cascadeFadeRange = 0.05;
    const float endFadeRange = 0.25;

    float occlusion = 0.0;
    if (view_depth < u_cascade_distances.x) {
        occlusion = evsm(light_view_pos0, u_shadowmap_0);
    }
    if (view_depth > u_cascade_distances.x * (1.0 - cascadeFadeRange) && view_depth < u_cascade_distances.y) {

        float occlusion1 = evsm(light_view_pos1, u_shadowmap_1);

        // If view_depth is within cascade 0 depth, mix the results
        occlusion = (view_depth >= u_cascade_distances.x) ? occlusion1 :
            mix(occlusion1, occlusion, (u_cascade_distances.x - view_depth) / (u_cascade_distances.x * cascadeFadeRange));
        
        // If view_depth is within end fade range, fade out
        if (view_depth > u_cascade_distances.y * (1.0 - endFadeRange)) {
            occlusion *= (u_cascade_distances.y - view_depth) / (u_cascade_distances.y * endFadeRange);
        }
    }

    return occlusion;
}


// vec3 shadowed_color_normal(
//     vec3 color, highp vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
//     highp float NDotL = dot(N, u_shadow_direction);
//     if (NDotL < 0.0)
//         return color * (1.0 - u_shadow_intensity);

//     NDotL = clamp(NDotL, 0.0, 1.0);

//     // Slope scale based on http://www.opengl-tutorial.org/intermediate-tutorials/tutorial-16-shadow-mapping/
//     highp float bias = u_shadow_bias.x + clamp(u_shadow_bias.y * tan(acos(NDotL)), 0.0, u_shadow_bias.z);
//     float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

//     float backfacing = 1.0 - smoothstep(0.0, 0.1, NDotL);
//     occlusion = mix(occlusion, 1.0, backfacing);
//     color *= 1.0 - (u_shadow_intensity * occlusion);
//     return color;
// }

vec3 shadowed_color_normal(
    vec3 color, highp vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    //float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, 0.0);
    //color *= occlusion;
    return color;
}


vec3 shadowed_color(vec3 color, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    float bias = 0.0;
    float occlusion = shadow_occlusion(light_view_pos0, light_view_pos1, view_depth, bias);

    color *= occlusion;
    return color;
}

#endif
