uniform sampler2D u_image0;
varying vec2 v_pos0;

uniform highp float u_near;
uniform highp float u_far;
uniform vec3 u_sun_direction;
uniform float u_fog_start;
uniform float u_fog_end;
uniform float u_fog_intensity;
uniform vec3 u_fog_color;

varying float v_distance;
varying vec3 v_position;

void main() {
    vec3 color = texture2D(u_image0, v_pos0).rgb;
    vec3 camera_ray = normalize(v_position);
    float depth = v_distance;

    // Fog
    float fog_falloff = 1.0 - clamp(exp(-(depth - u_fog_start) / (u_fog_end - u_fog_start)), 0.0, 1.0);
    color = mix(color, u_fog_color, fog_falloff * u_fog_intensity);

    gl_FragColor = vec4(color, 1.0);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
