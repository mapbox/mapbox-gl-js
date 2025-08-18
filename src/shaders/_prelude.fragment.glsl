// NOTE: This prelude is injected in the fragment shader only

out vec4 glFragColor;

highp float unpack_depth(highp vec4 rgba_depth)
{
    const highp vec4 bit_shift = vec4(1.0 / (255.0 * 255.0 * 255.0), 1.0 / (255.0 * 255.0), 1.0 / 255.0, 1.0);
    return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
}

// Pack depth to RGBA. A piece of code copied in various libraries and WebGL
// shadow mapping examples.
// https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
highp vec4 pack_depth(highp float ndc_z) {
    highp float depth = ndc_z * 0.5 + 0.5;
    const highp vec4 bit_shift = vec4(255.0 * 255.0 * 255.0, 255.0 * 255.0, 255.0, 1.0);
    const highp vec4 bit_mask  = vec4(0.0, 1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0);
    highp vec4 res = fract(depth * bit_shift);
    res -= res.xxyz * bit_mask;
    return res;
}

#ifdef INDICATOR_CUTOUT
uniform vec3 u_indicator_cutout_centers;
uniform vec4 u_indicator_cutout_params;
#endif

vec4 applyCutout(vec4 color, float height) {
#ifdef INDICATOR_CUTOUT
    float verticalFadeRange = u_indicator_cutout_centers.z * 0.25; // Fade relative to the height of the indicator
    float holeMinOpacity = mix(1.0, u_indicator_cutout_params.x, smoothstep(u_indicator_cutout_centers.z, u_indicator_cutout_centers.z + verticalFadeRange, height));
    float holeRadius = max(u_indicator_cutout_params.y, 0.0);
    float holeAspectRatio = u_indicator_cutout_params.z;
    float fadeStart = u_indicator_cutout_params.w;
    float distA = distance(vec2(gl_FragCoord.x, gl_FragCoord.y * holeAspectRatio), vec2(u_indicator_cutout_centers[0], u_indicator_cutout_centers[1] * holeAspectRatio));
    return color * min(smoothstep(fadeStart, holeRadius, distA) + holeMinOpacity, 1.0);
#else
    return color;
#endif
}

#ifdef DEBUG_WIREFRAME
    // Debug wireframe uses premultiplied alpha blending (alpha channel is left unchanged)
    #define HANDLE_WIREFRAME_DEBUG \
        glFragColor = vec4(0.7, 0.0, 0.0, 0.7); \
        gl_FragDepth = gl_FragCoord.z - 0.0001; // Apply depth for wireframe overlay to reduce z-fighting
#else
    #define HANDLE_WIREFRAME_DEBUG
#endif

#ifdef RENDER_CUTOFF
uniform highp vec4 u_cutoff_params;
in float v_cutoff_opacity;
#endif

// This function should be used in cases where mipmap usage is expected and
// the sampling coordinates are not continous. The lod_parameter should be
// a continous function derived from the sampling coordinates.
vec4 textureLodCustom(sampler2D image, highp vec2 pos, highp vec2 lod_coord) {
    highp vec2 size = vec2(textureSize(image, 0));
    highp vec2 dx = dFdx(lod_coord.xy * size);
    highp vec2 dy = dFdy(lod_coord.xy * size);
    highp float delta_max_sqr = max(dot(dx, dx), dot(dy, dy));
    highp float lod = 0.5 * log2(delta_max_sqr);
    // Note: textureLod doesn't support anisotropic filtering
    // We could use textureGrad instead which supports it, but it's discouraged
    // in the ARM Developer docs:
    // "Do not use textureGrad() unless absolutely necessary.
    // It is much slower that texture() and textureLod()..."
    // https://developer.arm.com/documentation/101897/0301/Buffers-and-textures/Texture-sampling-performance
    return textureLod(image, pos, lod);
}

vec4 applyLUT(highp sampler3D lut, vec4 col) {
    vec3 size = vec3(textureSize(lut, 0));
    // Sample from the center of the pixel in the LUT
    vec3 uvw = (col.rbg * float(size - 1.0) + 0.5) / size;
    return vec4(texture(lut, uvw).rgb * col.a, col.a);
}

vec3 applyLUT(highp sampler3D lut, vec3 col) {
    return applyLUT(lut, vec4(col, 1.0)).rgb;
}
