#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform sampler2D u_texture;
uniform sampler2D u_fadetexture;
#ifndef MAPBOX_GL_JS
uniform float u_opacity;
#else
uniform lowp float u_opacity;
#endif

varying vec2 v_tex;
varying vec2 v_fade_tex;

void main() {
#ifndef MAPBOX_GL_JS
    float alpha = texture2D(u_fadetexture, v_fade_tex).a * u_opacity;
#else
    lowp float alpha = texture2D(u_fadetexture, v_fade_tex).a * u_opacity;
#endif
    gl_FragColor = texture2D(u_texture, v_tex) * alpha;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
