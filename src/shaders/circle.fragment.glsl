varying vec3 v_data;
varying float v_visibility;

uniform vec3 u_ambient_color;
uniform vec3 u_sun_color;
uniform vec3 u_sun_dir;
uniform vec3 u_cam_fwd;
varying vec3 v_position;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define mediump float radius
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp vec4 stroke_color
#pragma mapbox: define mediump float stroke_width
#pragma mapbox: define lowp float stroke_opacity
#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define highp vec4 emissive_color
#pragma mapbox: define highp float metallic
#pragma mapbox: define highp float roughness


void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize mediump float radius
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp vec4 stroke_color
    #pragma mapbox: initialize mediump float stroke_width
    #pragma mapbox: initialize lowp float stroke_opacity
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize highp vec4 emissive_color
    #pragma mapbox: initialize highp float metallic
    #pragma mapbox: initialize highp float roughness

    vec2 extrude = v_data.xy;
    float extrude_length = length(extrude);

    lowp float antialiasblur = v_data.z;
    float antialiased_blur = -max(blur, antialiasblur);

    float opacity_t = smoothstep(0.0, antialiased_blur, extrude_length - 1.0);

    float color_t = stroke_width < 0.01 ? 0.0 : smoothstep(
        antialiased_blur,
        0.0,
        extrude_length - radius / (radius + stroke_width)
    );

    vec4 out_color = mix(color * opacity, stroke_color * stroke_opacity, color_t);
    Material mat = getPBRMaterial(out_color, metallic, roughness);
    out_color = vec4(computeLightContribution(mat, v_position, u_sun_dir, u_sun_color, u_ambient_color), mat.baseColor.w);
    
    // Emission
    out_color += emissive_color * emissive_strength;

#ifdef FOG
    out_color = fog_apply_premultiplied(out_color, v_fog_pos);
#endif

    gl_FragColor = out_color * (v_visibility * opacity_t);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
