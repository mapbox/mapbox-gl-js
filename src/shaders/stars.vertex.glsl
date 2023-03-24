// Position
attribute vec3 a_pos_3f;
// Offset from center ([-1, -1], ...)
attribute vec2 a_uv;
// Per-star size multiplier
attribute float a_size_scale;
// Per-star transparency multiplier
attribute float a_fade_opacity;

// mvp
uniform mat4 u_matrix;

// camera up & right vectors mulitplied by stars size
uniform vec3 u_up;
uniform vec3 u_right;

// Global stars transparency multiplier
uniform float u_intensity_multiplier;

varying highp vec2 v_uv;
varying mediump float v_intensity;

void main() {
    v_uv = a_uv;

    v_intensity = a_fade_opacity * u_intensity_multiplier;

    vec3 pos = a_pos_3f;

    pos += a_uv.x * u_right * a_size_scale;
    pos += a_uv.y * u_up * a_size_scale;

    gl_Position = u_matrix * vec4(pos, 1.0);
}
