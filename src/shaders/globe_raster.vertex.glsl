uniform mat4 u_proj_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform float u_zoom_transition;

attribute vec3 a_globe_pos;
attribute vec3 a_merc_pos;
attribute vec2 a_uv;

varying vec2 v_pos0;

void main() {
    v_pos0 = a_uv;

    vec3 height = elevationVector(a_uv * 8192.0) * elevation(a_uv * 8192.0);

    vec4 globe =  u_globe_matrix * vec4(a_globe_pos + height, 1.0);
    vec4 mercator = u_merc_matrix * vec4(a_merc_pos, 1.0);
    vec3 position = mix(globe.xyz, mercator.xyz, vec3(u_zoom_transition));

    gl_Position = u_proj_matrix * vec4(position, 1.0);
}
