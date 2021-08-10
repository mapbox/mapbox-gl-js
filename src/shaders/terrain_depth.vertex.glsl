//uniform mat4 u_matrix;
//attribute vec2 a_pos;
//attribute vec2 a_texture_pos;
//
//varying float v_depth;
//
//void main() {
//    float elevation = elevation(a_texture_pos);
//    gl_Position = u_matrix * vec4(a_pos, elevation, 1.0);
//    v_depth = gl_Position.z / gl_Position.w;
//}

uniform mat4 u_globe_matrix;
attribute vec3 a_globe_pos;
attribute vec2 a_uv;

varying float v_depth;

void main() {
    //vec3 elevation = elevationVector(a_texture_pos) * elevation(a_texture_pos);
    //gl_Position = u_matrix * vec4(vec3(a_pos, 0) + elevation, 1.0);
    gl_Position = u_globe_matrix * vec4(a_globe_pos + elevationVector(a_uv * 8192.0) * elevation(a_uv * 8192.0), 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
