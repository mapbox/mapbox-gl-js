uniform sampler2D u_texture;
uniform float u_fog_start;
uniform float u_fog_end;
uniform float u_fog_intensity;

varying vec2 v_tex;
varying float v_fade_opacity;
varying float v_distance;

#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize lowp float opacity

    lowp float alpha = opacity * v_fade_opacity;

    float fog_falloff = clamp(exp(-(v_distance - u_fog_start) / (u_fog_end - u_fog_start)), 0.0, 1.0);
    fog_falloff = step(0.5, fog_falloff);
    gl_FragColor = texture2D(u_texture, v_tex) * alpha * fog_falloff;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
