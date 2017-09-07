#pragma mapbox: define highp float weight

uniform mat4 u_matrix;
uniform float u_extrude_scale;
uniform float u_radius;
uniform float u_opacity;

attribute vec2 a_pos;

varying vec2 v_extrude;

void main(void) {
    #pragma mapbox: initialize highp float weight

    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    vec2 extrude = v_extrude * u_radius * u_extrude_scale;

    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    vec4 pos = vec4(floor(a_pos * 0.5) + extrude, 0, 1);

    gl_Position = u_matrix * pos;
}
