
varying float v_placed;
varying float v_notUsed;
varying float v_radius;
varying vec2 v_extrude;

void main() {
    float alpha = 0.5;

    // Blue = collision, hide label
    vec4 color = vec4(0.0, 0.0, 1.0, 1.0) * alpha;

    // Black = no collision, label is showing
    if (v_placed > 0.5) {
        color = vec4(0.0, 0.0, 0.0, 1.0) * alpha;
    }

    if (v_notUsed > 0.5) {
        // This box not used, fade it out
        color *= .1;
    }

    float extrude_length = length(v_extrude);
    if ((extrude_length < v_radius) && (extrude_length + 20.0 > v_radius)) {
        gl_FragColor = color;
    } else {
        gl_FragColor = 0.0 * color;
    }
}
