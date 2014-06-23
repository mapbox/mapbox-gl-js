precision mediump float;

uniform mat4 u_posmatrix;
uniform mat3 u_patternmatrix;

attribute vec2 a_pos;

varying vec2 v_pos;

void main() {
    gl_Position = u_posmatrix * vec4(a_pos, 0, 1);
    v_pos = (u_patternmatrix * vec3(a_pos, 1)).xy;
}
