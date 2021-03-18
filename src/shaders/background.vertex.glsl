attribute vec2 a_pos;

uniform mat4 u_matrix;

#ifdef FOG
varying float v_depth;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

#ifdef FOG
    v_depth = length(gl_Position.xyz);
#endif
}
