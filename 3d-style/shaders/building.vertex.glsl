#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"

in vec3 a_pos_3f;
in vec3 a_normal_3;
in vec3 a_centroid_3;

in vec4 a_faux_facade_data;
in vec2 a_faux_facade_vertical_range;

uniform mat4 u_matrix;
uniform mat4 u_normal_matrix;
uniform highp float u_tile_to_meter;

out vec4 v_color;
out vec3 v_normal;
out highp vec3 v_pos;

#ifdef BUILDING_FAUX_FACADE
out lowp float v_faux_facade;
out highp float v_faux_facade_ed;
out highp vec2 v_faux_facade_window;
out highp vec2 v_faux_facade_floor;
out highp vec2 v_faux_facade_range;
out highp float v_aspect;
out highp vec3 v_tbn_0;
out highp vec3 v_tbn_1;
out highp vec3 v_tbn_2;
out highp vec4 v_faux_color_emissive;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;
out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out float v_depth_shadows;
#endif

const float MAX_UINT_16 = 65535.0;
const float MAX_INT_16 = 32767.0;
const float MAX_UINT_8 = 255.0;
const float TWO_POW_8 = 256.0;

vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

#ifdef BUILDING_FAUX_FACADE
mat3 get_tbn(in vec3 normal) {
    const vec3 bitangent = vec3(0.0, 0.0, 1.0);
    vec3 tangent = normalize(vec3(normal.y, -normal.x, 0.0)); // -cross(bitangent, normal);
    return mat3(tangent, bitangent, normal);
}
#endif
#pragma mapbox: define-attribute-vertex-shader-only highp vec2 part_color_emissive
#pragma mapbox: define-attribute-vertex-shader-only highp vec2 faux_facade_color_emissive

void main() {
    #pragma mapbox: initialize-attribute-custom highp vec2 part_color_emissive
    #pragma mapbox: initialize-attribute-custom highp vec2 faux_facade_color_emissive

    vec4 color_emissive = decode_color(part_color_emissive);
    v_color = vec4(sRGBToLinear(color_emissive.rgb), color_emissive.a);

    vec3 a_normal_3f = a_normal_3 / MAX_INT_16;
    v_normal = vec3(u_normal_matrix * vec4(a_normal_3f, 0.0));

    float hidden = 0.0;
    
#ifdef BUILDING_FAUX_FACADE
    v_faux_facade = a_faux_facade_data.x;
    if (v_faux_facade > 0.0) {
        v_faux_facade_ed = a_faux_facade_data.x  * u_tile_to_meter;

        float window_x_perc = floor(a_faux_facade_data.y / TWO_POW_8);
        float window_y_perc = a_faux_facade_data.y - TWO_POW_8 * window_x_perc;
        vec2 window_perc = vec2(window_x_perc, window_y_perc) / MAX_UINT_8;

        v_faux_facade_floor = (a_faux_facade_data.zw / MAX_UINT_16 * EXTENT) * u_tile_to_meter;
        v_faux_facade_window = window_perc * v_faux_facade_floor;

        v_faux_facade_range = (a_faux_facade_vertical_range / MAX_UINT_16 * EXTENT) * u_tile_to_meter;

        v_aspect = v_faux_facade_window.x / v_faux_facade_window.y;

        mat3 tbn = get_tbn(normalize(v_normal));
        v_tbn_0 = tbn[0];
        v_tbn_1 = tbn[1];
        v_tbn_2 = tbn[2];

        v_faux_color_emissive = decode_color(faux_facade_color_emissive);
        v_faux_color_emissive.rgb = sRGBToLinear(v_faux_color_emissive.rgb);
    }
#endif
    v_pos = a_pos_3f;

#ifdef RENDER_CUTOFF
    vec4 ground = u_matrix * vec4(a_centroid_3, 1.0);
    v_cutoff_opacity = cutoff_opacity(u_cutoff_params, ground.z);
    hidden = float(v_cutoff_opacity == 0.0);
    v_pos.z *= v_cutoff_opacity;
#endif

#ifdef RENDER_SHADOWS
    vec3 shadow_pos = v_pos;
#ifdef NORMAL_OFFSET
    vec3 offset = shadow_normal_offset_model(v_normal);
    shadow_pos += offset * shadow_normal_offset_multiplier0();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shadow_pos, 1.0);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shadow_pos, 1.0);
    v_depth_shadows = gl_Position.w;
#endif

#ifdef FOG
    v_fog_pos = fog_position(v_pos);
#endif

    gl_Position = mix(u_matrix * vec4(v_pos, 1), AWAY, hidden);
}
