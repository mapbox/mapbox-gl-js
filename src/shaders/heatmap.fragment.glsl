#include "_prelude_fog.fragment.glsl"

uniform highp float u_intensity;

varying vec2 v_extrude;

#pragma mapbox: define highp float weight

// Gaussian kernel coefficient: 1 / sqrt(2 * PI)
#define GAUSS_COEF 0.3989422804014327

void main() {
    #pragma mapbox: initialize highp float weight

    // Kernel density estimation with a Gaussian kernel of size 5x5
    float d = -0.5 * 3.0 * 3.0 * dot(v_extrude, v_extrude);
    float val = weight * u_intensity * GAUSS_COEF * exp(d);

    gl_FragColor = vec4(val, 1.0, 1.0, 1.0);

#ifdef FOG
    // Globe uses a fixed range and heatmaps preserve
    // their color with this thin atmosphere layer to
    // prevent this layer from overly flickering
    if (u_is_globe == 0) {
        // Heatmaps work differently than other layers, so we operate on the accumulated
        // density rather than a final color. The power is chosen so that the density
        // fades into the fog at a reasonable rate.
        gl_FragColor.r *= pow(1.0 - fog_opacity(v_fog_pos), 2.0);
    }
#endif

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
