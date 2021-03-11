attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform vec2 u_world;

varying vec2 v_pos;

#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity

    gl_Position = u_matrix * vec4(a_pos, 0, 1);

    // v_pos has to be interpolated linearly in screen space as it's compared with the pixel position
    // (gl_FragCoord) in the fragment shader. This can be achieved by multiplying the value by
    // gl_Position.w in the vertex shader and by gl_FragCoord.w (e.g. 1/gl_Position.w) later in the fragment shader.
    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world * gl_Position.w;
}
