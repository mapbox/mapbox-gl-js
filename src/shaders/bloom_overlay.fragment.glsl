uniform sampler2D u_image0;
uniform vec2 u_dst_size;
vec4 Sample(vec2 uv) {
    return texture2D(u_image0, uv);
}

void main() {
    // Might or might not be off by half pixel
    gl_FragColor = texture2D(u_image0, gl_FragCoord.xy / u_dst_size);
}
