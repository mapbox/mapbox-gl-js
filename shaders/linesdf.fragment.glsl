uniform vec2 u_linewidth;

uniform float u_gamma;
uniform vec4 u_color;
uniform float u_fade;
uniform float u_sdfgamma;

uniform sampler2D u_image;

varying vec2 v_normal;
varying vec2 v_tex_a;
varying vec2 v_tex_b;

void main() {
    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal);

    dist *= u_linewidth.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_linewidth.t) or when fading out
    // (v_linewidth.s)
    float alpha = clamp(min(dist - (u_linewidth.t - 1.0), u_linewidth.s - dist) * u_gamma, 0.0, 1.0);

    float distA = texture2D(u_image, v_tex_a).a;
    float distB = texture2D(u_image, v_tex_b).a;
    alpha *= smoothstep(0.5 - u_sdfgamma, 0.5 + u_sdfgamma, mix(distA, distB, u_fade));

    gl_FragColor = u_color * alpha;
}
