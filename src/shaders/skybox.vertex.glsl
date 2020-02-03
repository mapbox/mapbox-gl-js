attribute vec3 a_pos;

uniform mat4 u_matrix;

varying vec3 v_uv;

void main() {
    v_uv = a_pos;
    vec4 pos = u_matrix * vec4(a_pos, 1);
    gl_Position = pos.xyww;
}
