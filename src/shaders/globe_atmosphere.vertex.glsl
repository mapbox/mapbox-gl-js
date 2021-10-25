attribute vec3 a_pos;
attribute vec2 a_uv;

uniform highp vec3 u_globe_center;
uniform highp vec3 u_camera_pos;
uniform highp vec3 u_camera_dir;
uniform highp vec3 u_tl;
uniform highp vec3 u_right;
uniform highp vec3 u_down;

varying vec3 viewVector;

void main() {
    vec3 point = u_tl + u_right * a_uv.x + u_down * a_uv.y;
    vec3 dir = point - u_camera_pos;

    viewVector = dir;
    gl_Position = vec4(a_pos, 1.0);
}
