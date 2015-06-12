
uniform vec2 u_dasharray;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_linesofar;
varying float gamma_scale;
varying float v_linewidth;
varying float v_linegapwidth;
varying float v_blur;

void main() {
    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_linewidth;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_linewidth.t) or when fading out
    // (v_linewidth.s)
    float blur = v_blur * gamma_scale;
    float alpha = clamp(min(dist - (v_linegapwidth - blur), v_linewidth - dist) / blur, 0.0, 1.0);

    gl_FragColor = v_color * alpha;
}
