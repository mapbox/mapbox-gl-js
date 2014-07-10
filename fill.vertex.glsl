attribute vec2 a_pos;
uniform mat4 u_posmatrix;

void main() {
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1);
    gl_PointSize = 2.0;
}
