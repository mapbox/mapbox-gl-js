attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform mat4 u_lighting_matrix;

varying vec3 v_position;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define highp vec4 emissive_color
#pragma mapbox: define highp float metallic
#pragma mapbox: define highp float roughness

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize highp vec4 emissive_color
    #pragma mapbox: initialize highp float metallic
    #pragma mapbox: initialize highp float roughness
    v_position  = vec3(u_lighting_matrix * vec4(a_pos, 0.0, 1.0));
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
