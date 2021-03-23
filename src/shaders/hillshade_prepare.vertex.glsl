uniform mat4 u_matrix;
uniform vec2 u_dimension;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos;

#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
varying vec3 v_fog_pos;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

    highp vec2 epsilon = 1.0 / u_dimension;
    float scale = (u_dimension.x - 2.0) / u_dimension.x;
    v_pos = (a_texture_pos / 8192.0) * scale + epsilon;

#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
    v_fog_pos = fog_position(a_pos);
#endif
}
