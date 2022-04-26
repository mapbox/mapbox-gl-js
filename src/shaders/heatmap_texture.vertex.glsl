attribute vec2 a_pos;

varying highp vec3 v_ray_dir;
varying vec2 v_pos;

void main() {
    gl_Position = vec4(a_pos, 0, 1);

    vec2 uv = a_pos * 0.5 + 0.5;

#ifdef FOG
    v_ray_dir = mix(
        mix(u_frustum_tl, u_frustum_tr, uv.x),
        mix(u_frustum_bl, u_frustum_br, uv.x),
        1.0 - uv.y);
#endif

    v_pos = uv;
}
