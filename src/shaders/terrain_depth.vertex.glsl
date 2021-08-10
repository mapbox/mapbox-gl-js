uniform mat4 u_matrix;
attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying float v_depth;

void main() {
    vec3 elevation = elevationVector(a_texture_pos) * elevation(a_texture_pos);
    gl_Position = u_matrix * vec4(vec3(a_pos, 0) + elevation, 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
