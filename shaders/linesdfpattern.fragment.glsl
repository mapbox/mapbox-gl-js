uniform sampler2D u_image;
uniform float u_sdfgamma;
uniform float u_mix;

varying vec2 v_normal;
varying vec2 v_tex_a;
varying vec2 v_tex_b;
varying vec4 v_color;
varying vec2 v_linewidth;
varying float v_blur;

void main() {
    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_linewidth.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_linewidth.t) or when fading out
    // (v_linewidth.s)
    float alpha = clamp(min(dist - (v_linewidth.t - v_blur), v_linewidth.s - dist) / v_blur, 0.0, 1.0);

    float sdfdist_a = texture2D(u_image, v_tex_a).a;
    float sdfdist_b = texture2D(u_image, v_tex_b).a;
    float sdfdist = mix(sdfdist_a, sdfdist_b, u_mix);
    alpha *= smoothstep(0.5 - u_sdfgamma, 0.5 + u_sdfgamma, sdfdist);

    gl_FragColor = v_color * alpha;
}
