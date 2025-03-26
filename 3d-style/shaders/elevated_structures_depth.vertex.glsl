in vec2 a_pos;
in float a_height;

uniform mat4 u_matrix;
uniform float u_depth_bias;

void main() {
    gl_Position = u_matrix * vec4(a_pos, a_height, 1);
    gl_Position.z = gl_Position.z + u_depth_bias;
}