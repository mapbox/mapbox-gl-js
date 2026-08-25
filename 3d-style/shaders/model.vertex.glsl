#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"
#include "_prelude_feature_cutout.vertex.glsl"

in vec3 a_pos_3f;

#pragma mapbox: define-attribute highp vec3 normal_3f
#pragma mapbox: define-attribute highp vec2 uv_2f
#pragma mapbox: define-attribute highp vec3 color_3f
#pragma mapbox: define-attribute highp vec4 color_4f
#pragma mapbox: define-attribute-vertex-shader-only highp uvec2 feature

// a_feature, the tiler's two per-vertex fields, swapped at load time into one component order.
// .x - vertex color, RGBA4444. Its alpha nibble is baked ambient occlusion, but only on LOD meshes
// .y - feature id. The low 4 bits select a part style, the rest is unused by rendering.

// Number of building parts a vertex can be tagged with. Must stay in step with PartNames in
// tiled_3d_model_bucket.hpp
#define MODEL_PART_COUNT 7u

// Size of the per-part style block, 4 vec4 per part
#define MODEL_PART_STYLE_SIZE_VEC4 28u

#ifdef HAS_ATTRIBUTE_a_feature
// Evaluated style of a single building part
struct ModelPartStyle {
    vec4 color_mix;     // model-color rgb, with model-color-mix-intensity in a.
    vec4 rmea;          // Roughness, metallic, emissive strength, model-color alpha.
    // Emissive strength height gradient: begin and end height as a fraction of the mesh z range,
    // then the multiplier value at the begin height and its span from begin to end.
    vec4 gradient;
    float gradient_power;   // Curve power of the emissive strength height gradient, already raised as pow(10, styled value).
};

// Style of every part, indexed by part id
layout(std140) uniform ModelPartStyleUniform {
    vec4 part_style[MODEL_PART_STYLE_SIZE_VEC4];
} u_model_part_style;

// .xy - z bounds of the mesh being drawn, as min and range in meters.
// .z - 1 for LOD meshes, whose vertex color alpha carries baked ambient occlusion
uniform vec4 u_model_mesh_params;
#endif

uniform mat4 u_matrix;
uniform mat4 u_node_matrix;
uniform mat4 u_lighting_matrix;
uniform vec3 u_camera_pos;
uniform vec4 u_color_mix;

#ifdef INSTANCED_ARRAYS
in vec4 a_normal_matrix0;
in vec4 a_normal_matrix1;
in vec4 a_normal_matrix2;
in vec4 a_normal_matrix3;
#else
uniform highp mat4 u_normal_matrix;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;
out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out float v_depth_shadows;
#endif

out vec4 v_position_height;
out lowp vec4 v_color_mix;

#ifdef TERRAIN_FRAGMENT_OCCLUSION
out highp float v_depth;
#endif

#if defined(FEATURE_CUTOUT_VERTEX) || defined(ROUTE_CORRIDOR)
out highp float v_cutout_factor;
#endif

#ifdef ROUTE_CORRIDOR
// Local model AABB max.z (meters); multiplied by instance |scale.z| for column roof height.
uniform float u_height;
#endif

#ifdef HAS_ATTRIBUTE_a_feature
out lowp vec4 v_roughness_metallic_emissive_alpha;
out mediump vec4 v_height_based_emission_params;
// .x - height-based interpolation factor
// .y - interpolation power
// .z - min value
// .w - max - min
#endif

// sRGB to linear approximation
vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

#ifdef HAS_ATTRIBUTE_a_feature
// Part id a vertex is tagged with. Ids this version has no style for fall back to the default
// part rather than wrapping, matching the CPU side.
uint decodeModelPartId(uvec2 feature) {
    uint partId = feature.y & 0xFu;
    return partId < MODEL_PART_COUNT ? partId : 0u;
}

// Vertex color, unpacked from RGBA4444 by widening each nibble to a full byte.
vec4 decodeModelVertexColor(uvec2 feature) {
    uvec4 nibbles = uvec4(feature.x >> 12u, feature.x >> 8u, feature.x >> 4u, feature.x) & 0xFu;
    return vec4(nibbles * 17u) / 255.0;
}

ModelPartStyle readModelPartStyle(uint partId) {
    uint base = partId * 4u;
    ModelPartStyle style;
    style.color_mix = u_model_part_style.part_style[base];
    style.rmea = u_model_part_style.part_style[base + 1u];
    style.gradient = u_model_part_style.part_style[base + 2u];
    style.gradient_power = u_model_part_style.part_style[base + 3u].x;
    return style;
}

// Blends the styled model-color over the vertex color by the styled mix intensity, then applies
// the baked ambient occlusion that only LOD meshes carry in their vertex color alpha.
vec3 modelAlbedo(ModelPartStyle style, vec4 vertexColor) {
    float ambientOcclusion = mix(1.0, vertexColor.a, u_model_mesh_params.z);
    return ambientOcclusion * mix(vertexColor.rgb, style.color_mix.rgb, style.color_mix.a);
}

// Emissive strength height gradient resolved against the z range of the mesh being drawn, packed
// the way the fragment shader reads it: .x height along the gradient, .y curve power,
// .z multiplier at the gradient begin, .w multiplier span across the gradient.
vec4 resolveModelEmissiveGradient(ModelPartStyle style, float height) {
    float begin = u_model_mesh_params.x + u_model_mesh_params.y * style.gradient.x;
    float span = u_model_mesh_params.y * (style.gradient.y - style.gradient.x);
    return vec4((height - begin) / span, style.gradient_power, style.gradient.z, style.gradient.w);
}
#endif

void main() {
    #pragma mapbox: initialize-attribute highp vec3 normal_3f
    #pragma mapbox: initialize-attribute highp vec2 uv_2f
    #pragma mapbox: initialize-attribute highp vec3 color_3f
    #pragma mapbox: initialize-attribute highp vec4 color_4f
    #pragma mapbox: initialize-attribute-custom highp uvec2 feature

    highp mat4 normal_matrix;
#ifdef INSTANCED_ARRAYS
    normal_matrix = mat4(a_normal_matrix0, a_normal_matrix1, a_normal_matrix2, a_normal_matrix3);
#else
    normal_matrix = u_normal_matrix;
#endif

#if defined(FEATURE_CUTOUT_VERTEX) || defined(ROUTE_CORRIDOR)
    v_cutout_factor = 1.0;
#endif

    vec3 local_pos;
    mat3 rs;
#ifdef MODEL_POSITION_ON_GPU
    vec3 pos_color = normal_matrix[0].xyz;
    vec4 translate = normal_matrix[1];
    vec3 pos_a = floor(pos_color);
    vec3 rgb = 1.05 * (pos_color - pos_a);
    float hidden = float(pos_a.x > EXTENT);
    float color_mix = pos_a.z / 100.0;
    v_color_mix = vec4(sRGBToLinear(rgb), color_mix);

    float meter_to_tile = normal_matrix[0].w;
    vec4 pos = vec4(pos_a.xy, translate.z, 1.0);

    rs[0].x = normal_matrix[1].w;
    rs[0].yz = normal_matrix[2].xy;
    rs[1].xy = normal_matrix[2].zw;
    rs[1].z = normal_matrix[3].x;
    rs[2].xyz = normal_matrix[3].yzw;

    vec4 pos_node = u_lighting_matrix * vec4(a_pos_3f, 1.0);
    vec3 rotated_pos_node = rs * pos_node.xyz;
    vec3 pos_model_tile = (rotated_pos_node + vec3(translate.xy, 0.0)) * vec3(meter_to_tile, meter_to_tile, 1.0);

    pos.xyz += pos_model_tile;
    local_pos = pos.xyz;

    gl_Position = mix(u_matrix * pos, AWAY, hidden);
    pos.z *= meter_to_tile;
    v_position_height.xyz = pos.xyz - u_camera_pos;

#ifdef ROUTE_CORRIDOR
    // Uniform centroid column: same fade for the whole instance (centroid XY + height, no span).
    float roofZ = u_height * sqrt(max(dot(rs[2], rs[2]), 0.0));
    float routeFade = computeRouteCorridorCentroidFade(pos_a.xy, roofZ, 0.0, 0.0);
    v_cutout_factor = 1.0 - routeFade;
#endif

#ifdef FEATURE_CUTOUT_VERTEX
    // Legacy above-cutout: sample cutout from the tile position of the feature
    highp vec4 ground_pos = vec4(pos_a.xy, 0.0, 1.0);
    highp vec4 cutout_clip_pos = mix(u_matrix * ground_pos, AWAY, hidden);
    highp vec3 cutout_ndc = cutout_clip_pos.xyz / cutout_clip_pos.w;
    vec2 uv = cutout_ndc.xy * 0.5 + 0.5;
    highp float fragDepthNDC = cutout_ndc.z * 0.5 + 0.5;
#ifdef FLIP_Y
    fragDepthNDC = cutout_ndc.z;
#endif
    highp float cutoutFactor = get_cutout_factors_vert(uv).x;
    highp float cutoutDepthNDC = sample_cutout_depth(u_cutout_depth_image, uv);
    // Prevent cutting above ground
    highp float groundThreshold = 0.001;
    highp float groundLimit = clamp((fragDepthNDC + groundThreshold - cutoutDepthNDC) / groundThreshold + 0.5, 0.0, 1.0);
    v_cutout_factor = mix(1.0 - cutoutFactor, 1.0, groundLimit);
#endif

#else
    local_pos = a_pos_3f;
    gl_Position = u_matrix * vec4(a_pos_3f, 1);
    v_position_height.xyz = vec3(u_lighting_matrix * vec4(a_pos_3f, 1));
    v_color_mix = vec4(sRGBToLinear(u_color_mix.rgb), u_color_mix.a);
#endif
    v_position_height.w = a_pos_3f.z;
#ifdef HAS_ATTRIBUTE_a_feature
    ModelPartStyle part_style = readModelPartStyle(decodeModelPartId(feature));

    // Note: the resulting color is in linear color space
    v_color_mix = vec4(modelAlbedo(part_style, decodeModelVertexColor(feature)), 1.0);
    v_roughness_metallic_emissive_alpha = part_style.rmea;
    v_height_based_emission_params = resolveModelEmissiveGradient(part_style, a_pos_3f.z);
#endif
#ifdef FOG
    v_fog_pos = fog_position(local_pos);
#endif

#ifdef RENDER_CUTOFF
    v_cutoff_opacity = cutoff_opacity(u_cutoff_params, gl_Position.z);
#endif

#ifdef TERRAIN_FRAGMENT_OCCLUSION
    v_depth = gl_Position.z / gl_Position.w;

    #ifdef CLIP_ZERO_TO_ONE
        v_depth = -1.0 + 2.0 * v_depth; 
    #endif

#endif



#ifdef HAS_ATTRIBUTE_a_normal_3f
#ifdef MODEL_POSITION_ON_GPU
    float x_squared_scale = dot(rs[0], rs[0]);
    float y_squared_scale = dot(rs[1], rs[1]);
    float z_squared_scale = dot(rs[2], rs[2]);
    // https://lxjk.github.io/2017/10/01/Stop-Using-Normal-Matrix.html
    vec3 squared_scale = vec3(x_squared_scale, y_squared_scale, z_squared_scale);
    normal_3f = rs * ((u_lighting_matrix * vec4(normal_3f, 0.0)).xyz / squared_scale);
    normal_3f = normalize(normal_3f);
#else
    normal_3f = vec3(normal_matrix * vec4(normal_3f, 0));
#endif
#endif

#ifdef HAS_ATTRIBUTE_a_feature
#ifdef HAS_ATTRIBUTE_a_color_4f
    v_roughness_metallic_emissive_alpha.w = clamp(color_4f.a * v_roughness_metallic_emissive_alpha.w * (v_roughness_metallic_emissive_alpha.z - 1.0), 0.0, 1.0);
#endif
#endif

#ifdef RENDER_SHADOWS
    vec4 shadow_pos = u_node_matrix * vec4(local_pos, 1.0);
#ifdef NORMAL_OFFSET
#ifdef HAS_ATTRIBUTE_a_normal_3f
#ifdef MODEL_POSITION_ON_GPU
    // flip the xy to bring it to the same, wrong, fill extrusion normal orientation toward inside.
    // See the explanation in shadow_normal_offset.
    vec3 offset = shadow_normal_offset(vec3(-normal_3f.xy, normal_3f.z));
    shadow_pos.xyz += offset * shadow_normal_offset_multiplier0();
#else
    vec3 offset = shadow_normal_offset_model(normal_3f);
    shadow_pos.xyz += offset * shadow_normal_offset_multiplier0();
#endif
#endif // HAS_ATTRIBUTE_a_normal_3f
#endif // NORMAL_OFFSET
    v_pos_light_view_0 = u_light_matrix_0 * shadow_pos;
    v_pos_light_view_1 = u_light_matrix_1 * shadow_pos;
    v_depth_shadows = gl_Position.w;
#endif // RENDER_SHADOWS
}
