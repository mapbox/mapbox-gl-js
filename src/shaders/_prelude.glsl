// IMPORTANT:
// This prelude is injected in both vertex and fragment shader be wary
// of precision qualifiers as vertex and fragment precision may differ

#define EPSILON 0.0000001
#define PI 3.141592653589793

// Coordinate-space conversions. Call sites name the operation; CLIP_ZERO_TO_ONE,
// VIEWPORT_ORIGIN_TOP_LEFT, and FLIP_Y are only consulted here and in
// _prelude.fragment.glsl. SHADOW_MAP_FLIP_Y is only consulted in
// _prelude_shadow.fragment.glsl (shadow_map_ndc_to_uv).
//
// File-scope macros, not functions with inner #ifdefs: Adreno's GLSL compiler
// miscompiles the latter in large programs (feature-cutout + instanced models).
//
// storage depth: packed RGBA / decoded D24 in [0, 1]
// native NDC z: clip.z after w-divide (GL [-1, 1], Metal/Vulkan [0, 1])
// native clip z: homogeneous gl_Position.zw
// image UV: texture() coordinates with (0,0) at the bottom-left of the image (GL)
// native texture UV: texture() coordinates for the current backend
// framebuffer UV: origin of the current color/depth attachment
// window: pixel coordinates with (0,0) at the native framebuffer origin

#ifdef CLIP_ZERO_TO_ONE
#define storage_depth_to_native_ndc_z(z01) (z01)
#define native_ndc_z_to_storage_depth(ndc_z) (ndc_z)
#define native_clip_z_to_cutoff_depth(clip_z, clip_w) ((clip_z) * 2.0 - (clip_w))
#define native_depth_epsilon(eps) ((eps) * 0.5)
#define depth_range_to_native_ndc_z(z01, unpack) (((z01) * (unpack).x + (unpack).y) * 0.5 + 0.5)
#else
#define storage_depth_to_native_ndc_z(z01) ((z01) * 2.0 - 1.0)
#define native_ndc_z_to_storage_depth(ndc_z) ((ndc_z) * 0.5 + 0.5)
#define native_clip_z_to_cutoff_depth(clip_z, clip_w) (clip_z)
#define native_depth_epsilon(eps) (eps)
#define depth_range_to_native_ndc_z(z01, unpack) ((z01) * (unpack).x + (unpack).y)
#endif

#ifdef VIEWPORT_ORIGIN_TOP_LEFT
#define bottom_left_to_native_uv(uv) vec2((uv).x, 1.0 - (uv).y)
#define native_cubemap_direction(dir) (dir)
#else
#define bottom_left_to_native_uv(uv) (uv)
#define native_cubemap_direction(dir) vec3((dir).x, -(dir).y, (dir).z)
#endif

#if defined(VIEWPORT_ORIGIN_TOP_LEFT) || defined(FLIP_Y)
#define ndc_xy_to_framebuffer_uv(ndc_xy) vec2((ndc_xy).x * 0.5 + 0.5, 1.0 - ((ndc_xy).y * 0.5 + 0.5))
#else
#define ndc_xy_to_framebuffer_uv(ndc_xy) ((ndc_xy) * 0.5 + 0.5)
#endif

// NDC xy → UV for offscreen depth/cutout textures (terrain occlusion, feature-cutout vertex).
// Unlike ndc_xy_to_framebuffer_uv this does not apply FLIP_Y.
#define ndc_xy_to_depth_texture_uv(ndc_xy) bottom_left_to_native_uv((ndc_xy) * 0.5 + 0.5)

#ifdef RENDER_CUTOFF
// Calculates cutoff and fade out based on the supplied params and depth value
float cutoff_opacity(vec4 cutoff_params, float depth) {
    float near = cutoff_params.x;
    float far = cutoff_params.y;
    float cutoffStart = cutoff_params.z;
    float cutoffEnd = cutoff_params.w;

    float linearDepth = (depth - near) / (far - near);
    return clamp((linearDepth - cutoffStart) / (cutoffEnd - cutoffStart), 0.0, 1.0);
}
#endif
