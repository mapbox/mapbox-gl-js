uniform sampler2D u_image0;
uniform vec2 u_dst_size;
uniform float u_bloom_intensity;

vec4 Sample(vec2 uv) {
    return texture2D(u_image0, uv);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_dst_size;

    vec4 color = 
        Sample(uv + vec2(-1.0, -1.0) / u_dst_size) +
        Sample(uv + vec2( 1.0, -1.0) / u_dst_size) +
        Sample(uv + vec2( 1.0,  1.0) / u_dst_size) +
        Sample(uv + vec2(-1.0,  1.0) / u_dst_size);

    gl_FragColor = color * 0.25 * u_bloom_intensity;
    gl_FragColor.a = 1.0;
}
