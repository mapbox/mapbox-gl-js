uniform mat4 u_globe_matrix;
attribute vec3 a_globe_pos;
attribute vec2 a_uv;

varying float v_depth;

void main() {
    gl_Position = u_globe_matrix * vec4(a_globe_pos + elevationVector(a_uv * 8192.0) * elevation(a_uv * 8192.0), 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
