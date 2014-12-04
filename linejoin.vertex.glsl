attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform vec2 u_world;
uniform float u_size;

varying vec2 v_pos;

void main() {
    gl_Position = u_matrix * vec4(floor(a_pos / 2.0), 0.0, 1.0);
    v_pos = (gl_Position.xy + 1.0) * u_world;
    gl_PointSize = u_size;
}
