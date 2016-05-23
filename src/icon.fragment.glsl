#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform sampler2D u_texture;
uniform sampler2D u_fadetexture;
uniform lowp float u_opacity;

varying vec2 v_tex;
varying vec2 v_fade_tex;

void main() {
    lowp float alpha = texture2D(u_fadetexture, v_fade_tex).a * u_opacity;
    gl_FragColor = texture2D(u_texture, v_tex) * alpha;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
