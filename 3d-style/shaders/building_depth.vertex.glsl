in vec3 a_pos_3f;

uniform mat4 u_matrix;
out highp float v_depth;

void main() {
    gl_Position = u_matrix * vec4(a_pos_3f, 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
