uniform sampler2D u_image;
uniform vec2 u_texel_size;
varying vec2 v_pos;

vec4 cubic(float v){
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    float w = 6.0 - x - y - z;
    return vec4(x, y, z, w) * (1.0/6.0);
}

vec4 textureBicubic(sampler2D img, vec2 texCoords, vec2 invTexSize){

	vec2 texSize = 1.0 / invTexSize;
	texCoords = texCoords * texSize - 0.5;

    vec2 fxy = fract(texCoords);
    texCoords -= fxy;

    vec4 xcubic = cubic(fxy.x);
    vec4 ycubic = cubic(fxy.y);

    vec4 c = texCoords.xxyy + vec2(-0.5, +1.5).xyxy;

    vec4 s = vec4(xcubic.xz + xcubic.yw, ycubic.xz + ycubic.yw);
    vec4 offset = c + vec4(xcubic.yw, ycubic.yw) / s;

    offset *= invTexSize.xxyy;

    vec4 sample0 = texture2D(img, offset.xz);
    vec4 sample1 = texture2D(img, offset.yz);
    vec4 sample2 = texture2D(img, offset.xw);
    vec4 sample3 = texture2D(img, offset.yw);

    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);

    return mix(
    	mix(sample3, sample2, sx), mix(sample1, sample0, sx)
    , sy);
}

void main() {
    vec2 texel_size = u_texel_size;
    float fog_depth = textureBicubic(u_image, v_pos, texel_size).r;

    // float fog_depth0 = texture2D(u_image, v_pos + (-1.0 * texel_size)).r;
    // float fog_depth1 = texture2D(u_image, v_pos + vec2(0.0, -texel_size.y)).r;
    // float fog_depth2 = texture2D(u_image, v_pos + vec2(texel_size.x, -texel_size.y)).r;
    // float fog_depth3 = texture2D(u_image, v_pos + vec2(-texel_size.x, 0.0)).r;
    // float fog_depth4 = texture2D(u_image, v_pos).r;
    // float fog_depth5 = texture2D(u_image, v_pos + vec2(texel_size.x, 0.0)).r;
    // float fog_depth6 = texture2D(u_image, v_pos + vec2(-texel_size.x, texel_size.y)).r;
    // float fog_depth7 = texture2D(u_image, v_pos + vec2(0.0, texel_size.y)).r;
    // float fog_depth8 = texture2D(u_image, v_pos + (1.0 * texel_size)).r;

    // float fog_depth = 1.0/16.0 * (
    //     fog_depth0 +
    //     2.0 * fog_depth1 +
    //     fog_depth2 +
    //     2.0 * fog_depth3 +
    //     4.0 * fog_depth4 +
    //     2.0 *fog_depth5 +
    //     fog_depth6 +
    //     2.0 * fog_depth7 +
    //     fog_depth8
    // );

    gl_FragColor = vec4(u_fog_color * fog_depth, fog_depth);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
