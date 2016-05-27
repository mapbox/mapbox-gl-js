#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

#ifdef MAPBOX_GL_JS
#pragma mapbox: define outline_color lowp
#else
uniform lowp vec4 u_color;
#endif

uniform lowp float u_opacity;

varying vec2 v_pos;

void main() {

#ifdef MAPBOX_GL_JS
    #pragma mapbox: initialize outline_color lowp
#else
    lowp vec4 outline_color = u_color;
#endif

    float dist = length(v_pos - gl_FragCoord.xy);
    float alpha = smoothstep(1.0, 0.0, dist);
    gl_FragColor = outline_color * (alpha * u_opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
