precision mediump float;

attribute vec2 a_pos;
attribute vec2 a_offset;
attribute vec2 a_tex;
attribute float a_angle;
attribute float a_minzoom;
attribute float a_rangeend;
attribute float a_rangestart;


// posmatrix is for the vertex position, exmatrix is for rotating and projecting
// the extrusion vector.
uniform mat4 u_posmatrix;
uniform mat4 u_exmatrix;
uniform float u_angle;
uniform float u_zoom;
uniform float u_flip;

uniform vec2 u_texsize;

varying vec2 v_tex;

void main() {

    float rev = 1.0;
    // We're using an int16 range for the angles.
    if (abs(a_angle + u_angle) > 32767.0 && u_flip > 0.0) rev = -1.0;

    // If the label should be invisible, we move the vertex outside
    // of the view plane so that the triangle gets clipped. This makes it easier
    // for us to create degenerate triangle strips.
    float z = 1.0 - step(a_minzoom, u_zoom);

    float angle = mod(u_angle/2.0 + 65536.0, 65536.0);
    z += step(a_rangeend, angle) * step(angle, a_rangestart);

    gl_Position = u_posmatrix * vec4(a_pos, 0, 1) + rev * u_exmatrix * vec4(a_offset / 64.0, z, 0);
    v_tex = a_tex * 4.0 / u_texsize;
}
