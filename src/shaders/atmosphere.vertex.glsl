attribute vec3 a_pos;
attribute vec2 a_uv;

// View frustum direction vectors pointing from the camera position to of each the corner points
uniform vec3 u_frustum_tl;
uniform vec3 u_frustum_tr;
uniform vec3 u_frustum_br;
uniform vec3 u_frustum_bl;
uniform float u_horizon;

varying highp vec3 v_ray_dir;
varying highp vec3 v_horizon_dir;

void main() {
    v_ray_dir = mix(
        mix(u_frustum_tl, u_frustum_tr, a_uv.x),
        mix(u_frustum_bl, u_frustum_br, a_uv.x),
        a_uv.y);

    v_horizon_dir = mix(
        mix(u_frustum_tl, u_frustum_bl, u_horizon),
        mix(u_frustum_tr, u_frustum_br, u_horizon),
        a_uv.x);

    gl_Position = vec4(a_pos, 1.0);
}
