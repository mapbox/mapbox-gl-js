uniform vec2 u_center;
uniform float u_radius;
uniform vec2 u_screen_size;

uniform float u_opacity;
uniform highp float u_fadeout_range;
uniform vec3 u_start_color;
uniform vec3 u_end_color;
uniform float u_pixel_ratio;

void main() {
    highp vec2 fragCoord = gl_FragCoord.xy / u_pixel_ratio;
    fragCoord.y = u_screen_size.y - fragCoord.y;
    float distFromCenter = length(fragCoord - u_center);

    float normDistFromCenter = length(fragCoord - u_center) / u_radius;

    if (normDistFromCenter < 1.0)
        discard;

    // exponential (sqrt) curve
    // [0.0, 1.0] == inside the globe, > 1.0 == outside of the globe
    float t = clamp(1.0 - sqrt(normDistFromCenter - 1.0) / u_fadeout_range, 0.0, 1.0);

    vec3 color = mix(u_start_color, u_end_color, 1.0 - t);

    gl_FragColor = vec4(color * t * u_opacity, u_opacity);
}