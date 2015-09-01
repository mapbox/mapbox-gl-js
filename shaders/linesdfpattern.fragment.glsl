uniform vec2 u_linewidth;
uniform vec4 u_color;
uniform float u_blur;
uniform sampler2D u_image;
uniform float u_sdfgamma;
uniform float u_mix;

varying vec2 v_normal;
varying vec2 v_tex_a;
varying vec2 v_tex_b;
varying float v_gamma_scale;

void main() {
    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * u_linewidth.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_linewidth.t) or when fading out
    // (v_linewidth.s)
    float blur = u_blur * v_gamma_scale;
    float alpha = clamp(min(dist - (u_linewidth.t - blur), u_linewidth.s - dist) / blur, 0.0, 1.0);

    float sdfdist_a = texture2D(u_image, v_tex_a).a;
    float sdfdist_b = texture2D(u_image, v_tex_b).a;
    float sdfdist = mix(sdfdist_a, sdfdist_b, u_mix);
    alpha *= smoothstep(0.5 - u_sdfgamma, 0.5 + u_sdfgamma, sdfdist);

    gl_FragColor = u_color * alpha;
}
