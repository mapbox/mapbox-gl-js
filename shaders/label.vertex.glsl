attribute vec2 a_pos;
attribute vec2 a_offset;
attribute vec2 a_tex;

uniform vec2 u_texsize;
uniform mat4 u_posmatrix;
uniform mat4 u_resizematrix;

varying vec2 v_tex;

void main() {
    vec2 a = a_offset;
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1) + u_resizematrix * vec4(a_offset, 0, 1);
    v_tex = a_tex / u_texsize;
}
