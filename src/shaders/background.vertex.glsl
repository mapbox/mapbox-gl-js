attribute vec2 a_pos;

uniform mat4 u_matrix;

#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
varying vec3 v_fog_pos;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
    v_fog_pos = fog_position(a_pos);
#endif
}
