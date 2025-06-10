#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"

uniform mat4 u_matrix;
uniform vec2 u_pixel_coord_upper;
uniform vec2 u_pixel_coord_lower;
uniform float u_tile_units_to_pixels;

in vec2 a_pos;
#ifdef ELEVATED_ROADS
in float a_road_z_offset;
out highp float v_road_z_offset;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out highp float v_depth;
#endif

out highp vec2 v_pos;

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp vec4 pattern
#ifdef FILL_PATTERN_TRANSITION
#pragma mapbox: define mediump vec4 pattern_b
#endif
#pragma mapbox: define lowp float pixel_ratio
#pragma mapbox: define highp float z_offset

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump vec4 pattern
    #pragma mapbox: initialize lowp float pixel_ratio
    #pragma mapbox: initialize highp float z_offset
    #ifdef FILL_PATTERN_TRANSITION
    #pragma mapbox: initialize mediump vec4 pattern_b
    #endif

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    vec2 display_size = (pattern_br - pattern_tl) / pixel_ratio;
#ifdef ELEVATED_ROADS
    z_offset += a_road_z_offset;
    v_road_z_offset = z_offset;
#endif
    float hidden = float(opacity == 0.0);
    gl_Position = mix(u_matrix * vec4(a_pos, z_offset, 1), AWAY, hidden);
    v_pos = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, display_size, u_tile_units_to_pixels, a_pos);

#ifdef RENDER_SHADOWS
    vec3 shd_pos0 = vec3(a_pos, z_offset);
    vec3 shd_pos1 = vec3(a_pos, z_offset);
#ifdef NORMAL_OFFSET
    vec3 offset = shadow_normal_offset(vec3(0.0, 0.0, 1.0));
    shd_pos0 += offset * shadow_normal_offset_multiplier0();
    shd_pos1 += offset * shadow_normal_offset_multiplier1();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shd_pos0, 1);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shd_pos1, 1);
    v_depth = gl_Position.w;
#endif

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
