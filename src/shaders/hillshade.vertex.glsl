uniform mat4 u_matrix;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos;

#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define highp vec4 emissive_color

void main() {
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize highp vec4 emissive_color
    
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_pos = a_texture_pos / 8192.0;

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
