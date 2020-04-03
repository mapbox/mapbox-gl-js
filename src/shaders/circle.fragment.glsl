varying vec3 v_data;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define mediump float radius
#pragma mapbox: define mediump float start_angle
#pragma mapbox: define mediump float end_angle
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp vec4 stroke_color
#pragma mapbox: define mediump float stroke_width
#pragma mapbox: define lowp float stroke_opacity

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize mediump float radius
    #pragma mapbox: initialize mediump float start_angle
    #pragma mapbox: initialize mediump float end_angle
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp vec4 stroke_color
    #pragma mapbox: initialize mediump float stroke_width
    #pragma mapbox: initialize lowp float stroke_opacity

    vec2 extrude = v_data.xy;
    float extrude_length = length(extrude);

    lowp float antialiasblur = v_data.z;
    float antialiased_blur = -max(blur, antialiasblur);

    float opacity_t = smoothstep(0.0, antialiased_blur, extrude_length - 1.0);

    #define DEG_TO_RAD(v) (v * 0.01745329251994329576)
    #define PI 3.14159265358979323846

    float angle_r = atan(v_data.y, -v_data.x) + PI;
    float start_angle_r = DEG_TO_RAD(start_angle);
    float end_angle_r = DEG_TO_RAD(end_angle);
    opacity_t = mix(opacity_t, 0.0, float(angle_r < start_angle_r || angle_r > end_angle_r));

    float color_t = stroke_width < 0.01 ? 0.0 : smoothstep(
        antialiased_blur,
        0.0,
        extrude_length - radius / (radius + stroke_width)
    );

    gl_FragColor = opacity_t * mix(color * opacity, stroke_color * stroke_opacity, color_t);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
