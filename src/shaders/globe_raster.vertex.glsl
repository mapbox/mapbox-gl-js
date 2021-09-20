uniform mat4 u_proj_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform mat4 u_up_vector_matrix;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;

attribute vec3 a_globe_pos;
attribute vec2 a_merc_pos;
attribute vec2 a_uv;

varying vec2 v_pos0;

void main() {
    v_pos0 = a_uv;

    vec2 uv = a_uv * EXTENT;
    vec4 up_vector = u_up_vector_matrix * vec4(elevationVector(uv), 1.0);
    float height = elevation(uv);

    vec4 globe = u_globe_matrix * vec4(a_globe_pos + up_vector.xyz * height, 1.0);

    vec4 mercator = vec4(a_merc_pos, height, 1.0);
    mercator.xy -= u_merc_center;
    mercator.x = wrap(mercator.x, -0.5, 0.5);
    mercator = u_merc_matrix * mercator;

    vec3 position = mix(globe.xyz, mercator.xyz, u_zoom_transition);

    gl_Position = u_proj_matrix * vec4(position, 1.0);
}
