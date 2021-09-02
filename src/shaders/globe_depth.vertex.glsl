//uniform mat4 u_matrix;
//attribute vec2 a_pos;
//attribute vec2 a_texture_pos;
//
//varying float v_depth;
//
//void main() {
//    float elevation = elevation(a_texture_pos);
//    gl_Position = u_matrix * vec4(a_pos, elevation, 1.0);
//    v_depth = gl_Position.z / gl_Position.w;
//}

uniform mat4 u_proj_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;

attribute vec3 a_globe_pos;
attribute vec2 a_merc_pos;
attribute vec2 a_uv;

varying float v_depth;

float wrap(float n, float min, float max) {
    float d = max - min;
    float w = mod(mod(n - min, d) + d, d) + min;
    return (w == min) ? max : w;
}

void main() {
    //vec3 elevation = elevationVector(a_texture_pos) * elevation(a_texture_pos);
    //gl_Position = u_matrix * vec4(vec3(a_pos, 0) + elevation, 1.0);
    vec3 height = elevationVector(a_uv * 8192.0) * elevation(a_uv * 8192.0);

    vec4 globe = u_globe_matrix * vec4(a_globe_pos + height, 1.0);

    vec4 mercator = vec4(a_merc_pos, 0.0, 1.0);
    mercator.xy -= u_merc_center;
    mercator.x = wrap(mercator.x, -0.5, 0.5);
    mercator = u_merc_matrix * mercator;

    vec3 t = vec3(u_zoom_transition);
    vec3 position = mix(globe.xyz, mercator.xyz, t);

    gl_Position = u_proj_matrix * vec4(position, 1.0);

    v_depth = gl_Position.z / gl_Position.w;
}
