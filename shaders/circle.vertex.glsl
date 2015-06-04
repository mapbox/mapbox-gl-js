// set by gl_util
uniform float u_size;

attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform mat4 u_exmatrix;

varying vec2 v_extrude;

void main(void) {
    // unencode the extrusion vector that we snuck into the a_pos vector
    v_extrude = vec2(
        mod(a_pos.x, 2.0) * 2.0 - 1.0,
        mod(a_pos.y, 2.0) * 2.0 - 1.0);
    vec4 extrude = u_exmatrix * vec4(v_extrude * u_size, 0, 0);
    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    gl_Position = u_matrix * vec4(a_pos * 0.5, 0, 1) + extrude;
}
