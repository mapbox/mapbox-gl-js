uniform mat4 u_posmatrix;
uniform float u_size;

attribute vec2 a_pos;
attribute vec2 a_extrude;

void main(void) {
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1);
}
