precision mediump float;

uniform vec4 u_color;

uniform vec2 u_rotate;
uniform vec2 u_offset;
uniform vec2 u_pattern_size;
uniform vec2 u_pattern_tl;
uniform vec2 u_pattern_br;
uniform float u_mix;


uniform sampler2D u_image;

varying vec2 v_pos;

void main() {

    vec2 imagecoord = mod((v_pos + u_offset) / u_pattern_size, 1.0) * u_rotate;
    vec2 pos = mix(u_pattern_tl, u_pattern_br, imagecoord);
    vec4 color1 = texture2D(u_image, pos);

    vec2 imagecoord2 = mod(imagecoord * 2.0, 1.0);
    vec2 pos2 = mix(u_pattern_tl, u_pattern_br, imagecoord2);
    vec4 color2 = texture2D(u_image, pos2);

    vec4 color = mix(color1, color2, u_mix);
    gl_FragColor = color + u_color * (1.0 - color.a);
}
