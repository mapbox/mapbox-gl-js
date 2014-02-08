precision mediump float;

attribute vec2 a_pos;
attribute vec2 a_offset;
attribute vec2 a_tex;
attribute float a_angle;
attribute float a_minzoom;
attribute float a_maxzoom;
attribute float a_rangeend;
attribute float a_rangestart;
attribute float a_labelminzoom;


// posmatrix is for the vertex position, exmatrix is for rotating and projecting
// the extrusion vector.
uniform mat4 u_posmatrix;
uniform mat4 u_exmatrix;
uniform float u_angle;
uniform float u_zoom;
uniform float u_flip;
uniform float u_fadedist;
uniform float u_minfadezoom;
uniform float u_maxfadezoom;
uniform float u_fadezoombump;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying float v_alpha;

void main() {

    float a_fadedist = 10.0;
    float rev = 0.0;
    // We're using an int18 range for the angles.
    float rotated = mod(a_angle + u_angle/2.0, 256.0) - 128.0;
    if (rotated >= -64.0 && rotated < 64.0 && u_flip > 0.0) rev = -1.0;

    // If the label should be invisible, we move the vertex outside
    // of the view plane so that the triangle gets clipped. This makes it easier
    // for us to create degenerate triangle strips.
    float z = 2.0 - step(a_minzoom, u_zoom) - (1.0 - step(a_maxzoom, u_zoom)) - rev;

    // fade out labels
    float alpha = clamp((u_zoom + u_fadezoombump - a_labelminzoom) / u_fadedist, 0.0, 1.0);

    // todo remove branching
    if (u_fadedist >= 0.0) {
        v_alpha = alpha;
    } else {
        v_alpha = 1.0 - alpha;
    }
    if (u_maxfadezoom < a_labelminzoom) {
        v_alpha = 0.0;
    }
    if (u_minfadezoom >= a_labelminzoom) {
        v_alpha = 1.0;
    }

    // if label has been faded out, clip it
    z += step(v_alpha, 0.0);

    float angle = mod(u_angle/2.0 + 256.0, 256.0);
    z += step(a_rangeend, angle) * (1.0 - step(a_rangestart, angle));

    gl_Position = u_posmatrix * vec4(a_pos, 0, 1) + u_exmatrix * vec4(a_offset / 64.0, z, 0);
    v_tex = a_tex * 4.0 / u_texsize;
}
