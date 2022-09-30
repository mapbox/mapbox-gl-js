uniform sampler2D u_texture;

uniform bool u_pitch_with_map;
uniform vec3 u_ambient_color;
uniform vec3 u_sun_color;
uniform vec3 u_sun_dir;
uniform vec3 u_cam_fwd;

varying vec2 v_tex;
varying float v_fade_opacity;

#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize lowp float opacity

    lowp float alpha = opacity * v_fade_opacity;
    vec4 out_color = texture2D(u_texture, v_tex) * alpha;
    
    if (u_pitch_with_map) {
        out_color = lighting_model(out_color, u_ambient_color, u_sun_color, u_sun_dir, u_cam_fwd);
    }
    
    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
