#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"

in vec3 a_pos_3f;

#pragma mapbox: define-attribute highp vec3 normal_3f
#pragma mapbox: define-attribute highp vec2 uv_2f
#pragma mapbox: define-attribute highp vec3 color_3f
#pragma mapbox: define-attribute highp vec4 color_4f
#pragma mapbox: define-attribute-vertex-shader-only highp vec4 pbr
#pragma mapbox: define-attribute-vertex-shader-only highp vec3 heightBasedEmissiveStrength

// pbr
// .xy - color.rgba (4 bytes)
// .z - emissive strength (1 byte) | roughness (4 bits) | metallic (4 bits)
// .w - heightBasedEmissionMultiplier value at interpolation Begin and Finish points (2 bytes)

// heightBasedEmissiveStrength
// .xy - interpolation parameters
// .z - interpolation curve power
// i.e.
// interpolatedHeight = pow(pos_z * .x + .y, .z)

uniform mat4 u_matrix;
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
out vec4 v_pos_light_view_0;
out vec4 v_pos_light_view_1;
out float v_depth_shadows;
#endif

out vec4 v_position_height;
out lowp vec4 v_color_mix;

#ifdef TERRAIN_FRAGMENT_OCCLUSION
out highp float v_depth;
#endif

#ifdef HAS_ATTRIBUTE_a_pbr
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

void main() {
    #pragma mapbox: initialize-attribute highp vec3 normal_3f
    #pragma mapbox: initialize-attribute highp vec2 uv_2f
    #pragma mapbox: initialize-attribute highp vec3 color_3f
    #pragma mapbox: initialize-attribute highp vec4 color_4f
    #pragma mapbox: initialize-attribute-custom highp vec4 pbr
    #pragma mapbox: initialize-attribute-custom highp vec3 heightBasedEmissiveStrength

    highp mat4 normal_matrix;
#ifdef INSTANCED_ARRAYS
    normal_matrix = mat4(a_normal_matrix0, a_normal_matrix1, a_normal_matrix2, a_normal_matrix3);
#else
    normal_matrix = u_normal_matrix;
#endif

    vec3 local_pos;
    mat3 rs;
#ifdef MODEL_POSITION_ON_GPU
    vec3 pos_color = normal_matrix[0].xyz;
    vec4 translate = normal_matrix[1];
    vec3 pos_a = floor(pos_color);
    vec3 rgb = 1.05 * (pos_color - pos_a);
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

    gl_Position = u_matrix * pos;
    pos.z *= meter_to_tile;
    v_position_height.xyz = pos.xyz - u_camera_pos;
#else
    local_pos = a_pos_3f;
    gl_Position = u_matrix * vec4(a_pos_3f, 1);
    v_position_height.xyz = vec3(u_lighting_matrix * vec4(a_pos_3f, 1));
    v_color_mix = vec4(sRGBToLinear(u_color_mix.rgb), u_color_mix.a);
#endif
    v_position_height.w = a_pos_3f.z;
#ifdef HAS_ATTRIBUTE_a_pbr
    vec4 albedo_c = decode_color(pbr.xy);

    vec2 e_r_m = unpack_float(pbr.z);
    vec2 r_m =  unpack_float(e_r_m.y * 16.0);
    r_m.r = r_m.r * 16.0;

    // Note: the decoded color is in linear color space
    v_color_mix = vec4(albedo_c.rgb, 1.0); // vertex color is computed on CPU
    v_roughness_metallic_emissive_alpha = vec4(vec3(r_m, e_r_m.x) / 255.0, albedo_c.a);
    v_roughness_metallic_emissive_alpha.z *= 2.0; // range [0..2] was shrank to fit [0..1]

    float heightBasedRelativeIntepolation = a_pos_3f.z * heightBasedEmissiveStrength.x + heightBasedEmissiveStrength.y;

    v_height_based_emission_params.x = heightBasedRelativeIntepolation;
    v_height_based_emission_params.y = heightBasedEmissiveStrength.z;

    vec2 emissionMultiplierValues = unpack_float(pbr.w) / 256.0;

    v_height_based_emission_params.z = emissionMultiplierValues.x;
    v_height_based_emission_params.w = emissionMultiplierValues.y - emissionMultiplierValues.x;
#endif
#ifdef FOG
    v_fog_pos = fog_position(local_pos);
#endif

#ifdef RENDER_CUTOFF
    v_cutoff_opacity = cutoff_opacity(u_cutoff_params, gl_Position.z);
#endif

#ifdef TERRAIN_FRAGMENT_OCCLUSION
    v_depth = gl_Position.z / gl_Position.w;
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

#ifdef HAS_ATTRIBUTE_a_pbr
#ifdef HAS_ATTRIBUTE_a_color_4f
    v_roughness_metallic_emissive_alpha.w = clamp(color_4f.a * v_roughness_metallic_emissive_alpha.w * (v_roughness_metallic_emissive_alpha.z - 1.0), 0.0, 1.0);
#endif
#endif

#ifdef RENDER_SHADOWS
    vec3 shadow_pos = local_pos;
#ifdef NORMAL_OFFSET
#ifdef HAS_ATTRIBUTE_a_normal_3f
#ifdef MODEL_POSITION_ON_GPU
     // flip the xy to bring it to the same, wrong, fill extrusion normal orientation toward inside.
     // See the explanation in shadow_normal_offset.
     vec3 offset = shadow_normal_offset(vec3(-normal_3f.xy, normal_3f.z));
     shadow_pos += offset * shadow_normal_offset_multiplier0();
#else
    vec3 offset = shadow_normal_offset_model(normalize(normal_3f));
    shadow_pos += offset * shadow_normal_offset_multiplier0();
#endif
#endif // HAS_ATTRIBUTE_a_normal_3f
#endif // NORMAL_OFFSET
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shadow_pos, 1);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shadow_pos, 1);
    v_depth_shadows = gl_Position.w;
#endif // RENDER_SHADOWS
}
