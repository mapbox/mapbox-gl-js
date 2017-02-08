attribute vec2 a_pos;
attribute vec2 a_extrude;
attribute vec2 a_data;

uniform mat4 u_matrix;
uniform float u_scale;

varying float v_max_zoom;
varying float v_placement_zoom;

void main() {
    gl_Position = u_matrix * vec4(a_pos + a_extrude / u_scale, 0.0, 1.0);

    v_max_zoom = a_data.x;
    v_placement_zoom = a_data.y;
}
