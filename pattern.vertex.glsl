uniform mat4 u_matrix;
uniform mat3 u_patternmatrix_a;
uniform mat3 u_patternmatrix_b;

attribute vec2 a_pos;

varying vec2 v_pos_a;
varying vec2 v_pos_b;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_pos_a = (u_patternmatrix_a * vec3(a_pos, 1)).xy;
    v_pos_b = (u_patternmatrix_b * vec3(a_pos, 1)).xy;
}
