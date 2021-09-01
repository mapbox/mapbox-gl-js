uniform mat4 u_proj_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;

attribute vec3 a_globe_pos;
attribute vec3 a_merc_pos;
attribute vec2 a_uv;

varying vec2 v_pos0;

float wrap(float n, float min, float max) {
    float d = max - min;
    float w = mod(mod(n - min, d) + d, d) + min;
    return (w == min) ? max : w;
}

void main() {
    v_pos0 = a_uv;

    vec3 height = elevationVector(a_uv * 8192.0) * elevation(a_uv * 8192.0);

    vec4 globe =  u_globe_matrix * vec4(a_globe_pos + height, 1.0);

    vec4 mercator = vec4(a_merc_pos, 1.0);
    mercator.xy -= u_merc_center;
    mercator.x = wrap(mercator.x, -0.5, 0.5);
    mercator = u_merc_matrix * mercator;

    vec3 t = vec3(u_zoom_transition);
    vec3 position = mix(globe.xyz, mercator.xyz, t);

    gl_Position = u_proj_matrix * vec4(position, 1.0);
}
