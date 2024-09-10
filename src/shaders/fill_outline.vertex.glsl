#include "_prelude_fog.vertex.glsl"

in vec2 a_pos;
#ifdef ELEVATED_ROADS
in float a_road_z_offset;
#endif

uniform mat4 u_matrix;
uniform vec2 u_world;

out highp vec2 v_pos;

#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp float z_offset

void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp float z_offset

#ifdef ELEVATED_ROADS
    z_offset += a_road_z_offset;
#endif
    float hidden = float(opacity == 0.0);
    gl_Position = mix(u_matrix * vec4(a_pos, z_offset, 1), AWAY, hidden);
    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
