uniform float u_zoom;
uniform float u_maxzoom;

varying float v_max_zoom;
varying float v_placement_zoom;

void main() {

    float alpha = 0.5;

    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0) * alpha;

    if (v_placement_zoom > u_zoom) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0) * alpha;
    }

    if (u_zoom >= v_max_zoom) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0) * alpha * 0.25;
    }

    if (v_placement_zoom >= u_maxzoom) {
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0) * alpha * 0.2;
    }
}
