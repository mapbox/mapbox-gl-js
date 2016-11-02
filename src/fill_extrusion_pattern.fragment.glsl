#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform vec2 u_pattern_tl_a;
uniform vec2 u_pattern_br_a;
uniform vec2 u_pattern_tl_b;
uniform vec2 u_pattern_br_b;
uniform float u_mix;

uniform sampler2D u_image;

varying vec2 v_pos_a;
varying vec2 v_pos_b;
varying vec4 v_lighting;

#ifdef MAPBOX_GL_JS
#pragma mapbox: define lowp float minH
#pragma mapbox: define lowp float maxH
#endif
#pragma mapbox: define lowp vec4 color

void main() {
#ifdef MAPBOX_GL_JS
    #pragma mapbox: initialize lowp float minH
    #pragma mapbox: initialize lowp float maxH
#endif
    #pragma mapbox: initialize lowp vec4 color

    vec2 imagecoord = mod(v_pos_a, 1.0);
    vec2 pos = mix(u_pattern_tl_a, u_pattern_br_a, imagecoord);
    vec4 color1 = texture2D(u_image, pos);

    vec2 imagecoord_b = mod(v_pos_b, 1.0);
    vec2 pos2 = mix(u_pattern_tl_b, u_pattern_br_b, imagecoord_b);
    vec4 color2 = texture2D(u_image, pos2);

    vec4 mixedColor = mix(color1, color2, u_mix);

    gl_FragColor = mixedColor * v_lighting;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
