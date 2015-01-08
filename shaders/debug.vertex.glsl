attribute vec2 a_pos;

uniform float u_pointsize;
uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_pos, step(32767.0, a_pos.x), 1);
    gl_PointSize = u_pointsize;
}
