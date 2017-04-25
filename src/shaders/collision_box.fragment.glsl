uniform float u_zoom;
uniform float u_maxzoom;

varying float v_max_zoom;
varying float v_placement_zoom;

void main() {

    float alpha = 1.0;

    // White = no collisions, label is showing
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * alpha;

    // Yellow = collision, label hidden
    if (v_placement_zoom > u_zoom) {
        gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0) * alpha;
    }

    // Black = this collision box is not used at this zoom (for curved labels)
    if (u_zoom >= v_max_zoom) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0) * alpha;
    }

    if (v_placement_zoom >= u_maxzoom) {
    // Blue = this collision box will not be placed at tile zoom + 1
    //  e.g. The only way to show this is overzooming
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0) * alpha;
    }
}
