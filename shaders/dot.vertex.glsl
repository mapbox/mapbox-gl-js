uniform mat4 u_posmatrix;
uniform float u_size;

attribute vec2 a_pos;

void main(void) {
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1);
    gl_PointSize = u_size;
}
