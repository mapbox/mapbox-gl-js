uniform sampler2D u_image;
uniform float u_opacity;
uniform int u_blend_mode;
in vec2 v_pos;

#define ADDITIVE 1

void main() {
    vec4 color = texture(u_image, v_pos);

    if (u_blend_mode == ADDITIVE) {
        // Additive mode: FBO is cleared to transparent black and alpha=0 means
        // untouched, so discard those pixels.
        if (color.a <= 0.0) {
            discard;
        }

        // Reinhard tone mapping on accumulated density
        float density = color.a;
        vec3 avgColor = color.rgb / max(density, 0.001);
        float t = density / (1.0 + density);
        glFragColor = vec4(avgColor * t * u_opacity, t * u_opacity);
    } else {
        // Multiply mode: the FBO is cleared to opaque white (1,1,1,1) and each
        // line fragment outputs its per-pixel multiply factor. The FBO accumulates
        // these via ColorMode.multiply (DST_COLOR * ZERO), so color.rgb already
        // holds the combined product of all line factors, with alpha=1 throughout.
        //
        // A pixel untouched by any line retains the clear value (1,1,1,1), which
        // is a no-op under ColorMode.multiply composite — no discard needed.
        //
        // Scale the factor toward 1.0 (no-op) by u_opacity so that line-opacity
        // modulates the strength of the multiply effect:
        //   final_factor = lerp(1, fbo_factor, opacity) = fbo_factor*opacity + (1-opacity)
        vec3 multiplyFactor = color.rgb * u_opacity + (1.0 - u_opacity);
        glFragColor = vec4(multiplyFactor, 1.0);
    }

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(0.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
