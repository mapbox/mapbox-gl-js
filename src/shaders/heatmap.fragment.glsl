#pragma mapbox: define highp float weight

uniform float u_weight_scale;
varying vec2 v_extrude;

void main() {
    #pragma mapbox: initialize highp float weight

    float len = length(v_extrude);
    float val = weight * u_weight_scale * 0.3989422804014327 * exp(-0.5 * 25.0 * len * len);

    // if (len > 0.99) val = 1.0;

    gl_FragColor = vec4(1.0, 1.0, 1.0, val);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
