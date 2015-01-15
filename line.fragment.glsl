uniform vec2 u_linewidth;
uniform vec4 u_color;
uniform float u_blur;

varying vec2 v_normal;

void main() {
    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * u_linewidth.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_linewidth.t) or when fading out
    // (v_linewidth.s)
    float alpha = clamp(min(dist - (u_linewidth.t - u_blur), u_linewidth.s - dist) / u_blur, 0.0, 1.0);

    gl_FragColor = u_color * alpha;
}
