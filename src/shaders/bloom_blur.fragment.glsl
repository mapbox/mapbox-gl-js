uniform sampler2D u_image0;

uniform vec2 u_dst_size;
uniform float u_bloom_threshold;
uniform float u_bloom_prefilter;

float RelativeLuminance(vec3 color) {
    return dot(vec3(0.2125, 0.7154, 0.0721), color);
}

vec4 Sample(vec2 uv) {
    vec4 color = texture2D(u_image0, uv);

    if (u_bloom_prefilter != 0.0) {
        float luminance = RelativeLuminance(color.rgb);
        float contrib = max(0.0, luminance - u_bloom_threshold) / max(luminance, 0.000001);

        color.rgb *= contrib;
    }

    return color;
}

void main() {
    gl_FragColor = vec4(1.0);

    vec2 uv = gl_FragCoord.xy / u_dst_size;

    vec4 color = 
        Sample(uv + vec2(-0.5, -0.5) / u_dst_size) +
        Sample(uv + vec2( 0.5, -0.5) / u_dst_size) +
        Sample(uv + vec2( 0.5,  0.5) / u_dst_size) +
        Sample(uv + vec2(-0.5,  0.5) / u_dst_size);

    gl_FragColor = color * 0.25;
    gl_FragColor.a = 1.0;
}
