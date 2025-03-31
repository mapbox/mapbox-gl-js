#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

in vec3 v_data;
in float v_visibility;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define mediump float radius
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp vec4 stroke_color
#pragma mapbox: define mediump float stroke_width
#pragma mapbox: define lowp float stroke_opacity

uniform float u_emissive_strength;

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize mediump float radius
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp vec4 stroke_color
    #pragma mapbox: initialize mediump float stroke_width
    #pragma mapbox: initialize lowp float stroke_opacity
    vec2 extrude = v_data.xy;
    float blur_positive = blur < 0.0 ? 0.0 : 1.0;
    lowp float antialiasblur = v_data.z;
    float extrude_length = length(extrude) + antialiasblur * (1.0 - blur_positive);
    float antialiased_blur = -max(abs(blur), antialiasblur);
    float antialiase_blur_opacity = smoothstep(0.0, antialiasblur, extrude_length - 1.0);
    float opacity_t = blur_positive == 1.0 ? 
                        smoothstep(0.0, -antialiased_blur, 1.0 - extrude_length) : 
                        smoothstep(antialiased_blur, 0.0, extrude_length - 1.0) - antialiase_blur_opacity;
    float color_t = stroke_width < 0.01 ? 0.0 : smoothstep(
        antialiased_blur,
        0.0,
        extrude_length - radius / (radius + stroke_width)
    );

    vec4 out_color = mix(color * opacity, stroke_color * stroke_opacity, color_t);

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission_ground(out_color, u_emissive_strength);
#endif
#ifdef FOG
    out_color = fog_apply_premultiplied(out_color, v_fog_pos);
#endif

    glFragColor = out_color * (v_visibility * opacity_t);

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif
}
