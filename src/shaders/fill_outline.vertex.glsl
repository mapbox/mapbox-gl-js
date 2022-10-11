attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform vec2 u_world;

uniform mat4 u_lighting_matrix;
varying vec2 v_pos;
varying vec3 v_lightingPos;


#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define highp vec4 emissive_color
#pragma mapbox: define highp float metallic
#pragma mapbox: define highp float roughness
void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize highp vec4 emissive_color
    #pragma mapbox: initialize highp float metallic
    #pragma mapbox: initialize highp float roughness

    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_lightingPos = vec3(u_lighting_matrix * vec4(a_pos, 0, 1));
    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
