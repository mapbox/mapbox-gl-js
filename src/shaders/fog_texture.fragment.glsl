uniform sampler2D u_image;
uniform vec2 u_texel_size;
varying vec2 v_pos;

void main() {
    vec2 texel_size = u_texel_size;

    float fog_depth0 = texture2D(u_image, v_pos + (-1.0 * texel_size)).r;
    float fog_depth1 = texture2D(u_image, v_pos + vec2(0.0, -texel_size.y)).r;
    float fog_depth2 = texture2D(u_image, v_pos + vec2(texel_size.x, -texel_size.y)).r;
    float fog_depth3 = texture2D(u_image, v_pos + vec2(-texel_size.x, 0.0)).r;
    float fog_depth4 = texture2D(u_image, v_pos).r;
    float fog_depth5 = texture2D(u_image, v_pos + vec2(texel_size.x, 0.0)).r;
    float fog_depth6 = texture2D(u_image, v_pos + vec2(-texel_size.x, texel_size.y)).r;
    float fog_depth7 = texture2D(u_image, v_pos + vec2(0.0, texel_size.y)).r;
    float fog_depth8 = texture2D(u_image, v_pos + (1.0 * texel_size)).r;

    float fog_depth = 1.0/16.0 * (
        fog_depth0 +
        2.0 * fog_depth1 +
        fog_depth2 +
        2.0 * fog_depth3 +
        4.0 * fog_depth4 +
        2.0 *fog_depth5 +
        fog_depth6 +
        2.0 * fog_depth7 +
        fog_depth8
    );

    gl_FragColor = vec4(u_fog_color * fog_depth, fog_depth);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
