attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform vec2 u_offset;

varying vec2 v_coords[3];

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

    vec2 tex = gl_Position.xy / 2.0 + 0.5;
    v_coords[0] = tex;
    v_coords[1] = tex + u_offset * 1.1824255238063563;
    v_coords[2] = tex - u_offset * 1.1824255238063563;
}
