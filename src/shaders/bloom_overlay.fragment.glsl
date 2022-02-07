uniform sampler2D u_image0;
uniform vec2 u_dst_size;
uniform float u_bloom_reflection_strength;

void main() {
    // Might or might not be off by half pixel
    vec4 color = texture2D(u_image0, gl_FragCoord.xy / u_dst_size);

    gl_FragColor = vec4(color.rgb * u_bloom_reflection_strength, 1.0);
}
