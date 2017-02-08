uniform mat4 u_matrix;
uniform int u_xdim;
uniform int u_ydim;
attribute vec2 a_pos;
varying vec2 v_pos;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

    v_pos.x = a_pos.x / float(u_xdim);
    v_pos.y = 1.0 - a_pos.y / float(u_ydim);
}
