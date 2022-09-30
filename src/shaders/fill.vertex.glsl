attribute vec2 a_pos;

uniform mat4 u_matrix;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define highp vec4 emissive_color

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize highp vec4 emissive_color

    gl_Position = u_matrix * vec4(a_pos, 0, 1);

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
