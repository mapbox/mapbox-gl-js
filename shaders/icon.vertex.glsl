attribute vec2 a_pos;
attribute vec2 a_offset;
attribute vec4 a_data1;
attribute vec4 a_data2;


// matrix is for the vertex position, exmatrix is for rotating and projecting
// the extrusion vector.
uniform mat4 u_matrix;
uniform mat4 u_exmatrix;
uniform float u_angle;
uniform float u_zoom;
uniform float u_flip;
uniform float u_fadedist;
uniform float u_minfadezoom;
uniform float u_maxfadezoom;
uniform float u_fadezoom;
uniform float u_opacity;

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
    vec2 a_range = a_data2.pq;
    float a_rangeend = a_range[0];
    float a_rangestart = a_range[1];

    float a_fadedist = 10.0;
    float rev = 0.0;

    // u_angle is angle of the map, -128..128 representing 0..2PI
    // a_angle is angle of the label, 0..256 representing 0..2PI, where 0 is horizontal text
    float rotated = mod(a_angle + u_angle, 256.0);
    // if the label rotates with the map, and if the rotated label is upside down, hide it
    if (u_flip > 0.0 && rotated >= 64.0 && rotated < 192.0) rev = 1.0;

    // If the label should be invisible, we move the vertex outside
    // of the view plane so that the triangle gets clipped. This makes it easier
    // for us to create degenerate triangle strips.
    // u_zoom is the current zoom level adjusted for the change in font size
    float z = 2.0 - step(a_minzoom, u_zoom) - (1.0 - step(a_maxzoom, u_zoom)) + rev;

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

    // all the angles are 0..256 representing 0..2PI
    // hide if (angle >= a_rangeend && angle < rangestart)
    z += step(a_rangeend, u_angle) * (1.0 - step(a_rangestart, u_angle));

    gl_Position = u_matrix * vec4(a_pos, 0, 1) + u_exmatrix * vec4(a_offset / 64.0, z, 0);
    v_tex = a_tex / u_texsize;

    v_alpha *= u_opacity;
}
