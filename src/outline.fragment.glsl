#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifndef MAPBOX_GL_JS
uniform vec4 u_color;
#else
uniform lowp vec4 u_color;
uniform lowp float u_opacity;
#endif

varying vec2 v_pos;

void main() {
    float dist = length(v_pos - gl_FragCoord.xy);
    float alpha = smoothstep(1.0, 0.0, dist);
#ifndef MAPBOX_GL_JS
    gl_FragColor = u_color * alpha;
#else
    gl_FragColor = u_color * (alpha * u_opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
#endif
}
