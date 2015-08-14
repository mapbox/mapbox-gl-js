attribute vec2 a_pos;
attribute vec2 a_offset;
attribute vec4 a_data1;
attribute vec4 a_data2;


// matrix is for the vertex position, exmatrix is for rotating and projecting
// the extrusion vector.
uniform mat4 u_matrix;
uniform mat4 u_exmatrix;
uniform float u_zoom;
uniform float u_fadedist;
uniform float u_minfadezoom;
uniform float u_maxfadezoom;
uniform float u_fadezoom;
uniform float u_opacity;
uniform bool u_skewed;
uniform float u_extra;

uniform vec2 u_texsize;

varying vec2 v_tex;
varying float v_alpha;

void main() {
    vec2 a_tex = a_data1.xy;
    float a_labelminzoom = a_data1[2];
    float a_angle = a_data1[3];
    vec2 a_zoom = a_data2.st;
    float a_minzoom = a_zoom[0];
    float a_maxzoom = a_zoom[1];

    float a_fadedist = 10.0;

    // u_zoom is the current zoom level adjusted for the change in font size
    float z = 2.0 - step(a_minzoom, u_zoom) - (1.0 - step(a_maxzoom, u_zoom));

    // fade out labels
    float alpha = clamp((u_fadezoom - a_labelminzoom) / u_fadedist, 0.0, 1.0);

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

    if (u_skewed) {
        vec4 extrude = u_exmatrix * vec4(a_offset / 64.0, 0, 0);
        gl_Position = u_matrix * vec4(a_pos + extrude.xy, 0, 1);
        gl_Position.z += z * gl_Position.w;
    } else {
        vec4 extrude = u_exmatrix * vec4(a_offset / 64.0, z, 0);
        gl_Position = u_matrix * vec4(a_pos, 0, 1) + extrude;
    }

    v_tex = a_tex / u_texsize;

    v_alpha *= u_opacity;
}
