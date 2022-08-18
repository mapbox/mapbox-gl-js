uniform mat4 u_matrix;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_shadow_world_pos;
varying float v_depth;

#ifdef FOG
varying float v_fog_opacity;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);

    v_shadow_world_pos = a_pos;
    v_depth = gl_Position.w;

#ifdef FOG
    v_fog_opacity = fog(fog_position(a_pos));
#endif
}
