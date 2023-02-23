attribute vec3 a_pos_3f;
uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_pos_3f, 1.);
}
