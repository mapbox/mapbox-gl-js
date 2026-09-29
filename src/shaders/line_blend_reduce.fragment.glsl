uniform highp sampler2D u_image;
uniform vec2 u_texel_size;
uniform bool u_first_pass;
in vec2 v_pos;

void main() {
    // Hierarchical reduce to compute the mean density of occupied pixels.
    //
    // We track two quantities, dividing by 4 at each pass to prevent overflow
    // in RGBA16F (max ~65504) across the ~12 passes needed for a full-res FBO:
    //   R: sum of density values for occupied pixels, divided by 4 each pass
    //   G: count of occupied pixels, divided by 4 each pass
    //
    // The CPU reads the final 1×1 result and computes:
    //   meanOccupiedDensity = R / G
    //
    // This is the true mean density of pixels actually touched by lines,
    // with no dilution from empty pixels — so no large SCALE factor is needed.
    // A small headroom multiplier (~2×) is enough to place the mean at a
    // comfortable point on the Reinhard curve.
    //
    // Pass layout:
    //   First pass  (u_first_pass=true):  source is the line FBO whose
    //     accumulated density lives in alpha. Seed R and G from alpha.
    //   Later passes (u_first_pass=false): source is a previous reduce output
    //     where R and G already hold partial sums. Just add and divide by 4.

    vec2 o = u_texel_size * 0.5;

    vec4 s0 = texture(u_image, v_pos + vec2(-o.x, -o.y));
    vec4 s1 = texture(u_image, v_pos + vec2( o.x, -o.y));
    vec4 s2 = texture(u_image, v_pos + vec2(-o.x,  o.y));
    vec4 s3 = texture(u_image, v_pos + vec2( o.x,  o.y));

    float r0; float g0;
    float r1; float g1;
    float r2; float g2;
    float r3; float g3;

    if (u_first_pass) {
        // Source is the line FBO: density lives in alpha, RG are unused.
        float a0 = s0.a;
        float a1 = s1.a;
        float a2 = s2.a;
        float a3 = s3.a;

        // Seed R with density (0 for empty), G with occupancy (0 or 1).
        r0 = a0; g0 = a0 > 0.0 ? 1.0 : 0.0;
        r1 = a1; g1 = a1 > 0.0 ? 1.0 : 0.0;
        r2 = a2; g2 = a2 > 0.0 ? 1.0 : 0.0;
        r3 = a3; g3 = a3 > 0.0 ? 1.0 : 0.0;
    } else {
        // Source is a previous reduce output: R = partial density sum, G = partial count.
        r0 = s0.r; g0 = s0.g;
        r1 = s1.r; g1 = s1.g;
        r2 = s2.r; g2 = s2.g;
        r3 = s3.r; g3 = s3.g;
    }

    // Divide by 4 each pass to keep values bounded within RGBA16F range.
    glFragColor = vec4((r0 + r1 + r2 + r3) * 0.25,
                       (g0 + g1 + g2 + g3) * 0.25,
                       0.0, 0.0);
}
