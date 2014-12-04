uniform vec4 u_color;
uniform vec2 u_linewidth;

varying vec2 v_pos;

void main() {
    float dist = length(v_pos - gl_FragCoord.xy);

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_linewidth.t) or when fading out
    // (v_linewidth.s)
    float alpha = clamp(min(dist - (u_linewidth.t - 1.0), u_linewidth.s - dist), 0.0, 1.0);
    gl_FragColor = u_color * alpha;
}
