#ifdef RENDER_SHADOWS

uniform sampler2D u_shadowmap_0;
uniform sampler2D u_shadowmap_1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec2 u_cascade_distances;
uniform highp vec3 u_shadow_direction;
uniform highp vec3 u_shadow_bias;

float rand(float co) { return fract(sin(co * 91.3458) * 47453.5453); }
float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); } 
float rand(vec3 co) { return rand(co.xy + rand(co.z)); }


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

    highp vec2 texel = pos.xy / u_texel_size - vec2(0.5);
    highp vec2 f = fract(texel);

    highp float s = u_texel_size;

    // Perform percentage-closer filtering with a 2x2 sample grid.
    // Edge tap smoothing is used to weight each sample based on their contribution in the overall PCF kernel

    highp vec2 uv00 = (texel - f + 0.5) * s;
    highp vec2 uv10 = uv00 + vec2(1.0 * s, 0.0);

    highp vec2 uv01 = uv00 + vec2(0.0, 1.0 * s);
    highp vec2 uv11 = uv01 + vec2(1.0 * s, 0.0);

    highp float o00 = shadow_sample_1(uv00, compare1);
    highp float o10 = shadow_sample_1(uv10, compare1);

    highp float o01 = shadow_sample_1(uv01, compare1);
    highp float o11 = shadow_sample_1(uv11, compare1);

    // Edge tap smoothing
    highp float value = 
        (1.0 - f.x) * (1.0 - f.y) * o00 +
        f.x * (1.0 - f.y) * o10 +
        (1.0 - f.x) * f.y * o01 +
        f.x * f.y * o11;

    return clamp(value, 0.0, 1.0);
}

highp float shadow_occlusion_0(highp vec3 world_pos, highp vec4 pos, highp float bias) {
    float disc_radius = 5.0;
    vec2 poisson_disc[16];
    poisson_disc[0] = vec2(-0.372773, -0.479649);
    poisson_disc[1] = vec2(-0.147121, -0.977818);
    poisson_disc[2] = vec2(-0.117312, -0.0812339);
    poisson_disc[3] = vec2(0.136464, -0.719992);
    poisson_disc[4] = vec2(-0.918976, -0.172404);
    poisson_disc[5] = vec2(0.333555, -0.307162);
    poisson_disc[6] = vec2(-0.625878, -0.762456);
    poisson_disc[7] = vec2(-0.5919, 0.31843);
    poisson_disc[8] = vec2(-0.48248, 0.755864);
    poisson_disc[9] = vec2(0.126098, 0.320288);
    poisson_disc[10] = vec2(-0.0775654, 0.705741);
    poisson_disc[11] = vec2(0.359579, 0.890029);
    poisson_disc[12] = vec2(0.549337, 0.378352);
    poisson_disc[13] = vec2(0.713087, -0.639836);
    poisson_disc[14] = vec2(0.77732, -0.187863);
    poisson_disc[15] = vec2(0.907086, 0.180423);

    float angle = rand(world_pos);
    float cos_a = cos(angle);
    float sin_a = sin(angle);
    mat2 rotation = mat2(cos_a, sin_a, -sin_a, cos_a);

    pos.xyz /= pos.w;
    pos.xy = pos.xy * 0.5 + 0.5;
    highp float compare0 = min(pos.z, 0.999) - bias;

    mediump float accumulate = 0.0;
    for (int i = 0; i < 16; ++i) {
        accumulate += shadow_sample_0(pos.xy + (poisson_disc[i] * disc_radius * u_texel_size) * rotation, compare0);
    }

    return clamp(accumulate / 16.0, 0.0, 1.0);
}

float shadow_occlusion(highp vec3 world_pos, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth, highp float bias) {
    const float cascadeFadeRange = 0.05;
    const float endFadeRange = 0.25;

    float occlusion = 0.0;
    if (view_depth < u_cascade_distances.x) {
        occlusion = shadow_occlusion_0(world_pos, light_view_pos0, bias);
    }
    if (view_depth > u_cascade_distances.x * (1.0 - cascadeFadeRange) && view_depth < u_cascade_distances.y) {
        float occlusion1 = shadow_occlusion_1(light_view_pos1, bias);

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

vec3 shadowed_color_normal(
    vec3 color, highp vec3 world_pos, highp vec3 N, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    highp float NDotL = dot(N, u_shadow_direction);
    if (NDotL < 0.0)
        return color * (1.0 - u_shadow_intensity);

    NDotL = clamp(NDotL, 0.0, 1.0);

    // Slope scale based on http://www.opengl-tutorial.org/intermediate-tutorials/tutorial-16-shadow-mapping/
    highp float bias = u_shadow_bias.x + clamp(u_shadow_bias.y * tan(acos(NDotL)), 0.0, u_shadow_bias.z);
    float occlusion = shadow_occlusion(world_pos, light_view_pos0, light_view_pos1, view_depth, bias);

    float backfacing = 1.0 - smoothstep(0.0, 0.1, NDotL);
    occlusion = mix(occlusion, 1.0, backfacing);
    color *= 1.0 - (u_shadow_intensity * occlusion);
    return color;
}

vec3 shadowed_color(vec3 color, highp vec3 world_pos, highp vec4 light_view_pos0, highp vec4 light_view_pos1, float view_depth) {
    float bias = 0.0;
    float occlusion = shadow_occlusion(world_pos, light_view_pos0, light_view_pos1, view_depth, bias);

    color *= 1.0 - (u_shadow_intensity * occlusion);
    return color;
}

#endif
