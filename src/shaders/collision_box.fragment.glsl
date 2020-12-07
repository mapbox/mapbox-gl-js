varying float v_placed;
varying float v_notUsed;

void main() {
    vec4 red  = vec4(1.0, 0.0, 0.0, 1.0); // Red = collision, hide label
    vec4 blue = vec4(0.0, 0.0, 1.0, 0.5); // Blue = no collision, label is showing

    gl_FragColor  = mix(red, blue, step(0.5, v_placed)) * 0.5;
    gl_FragColor *= mix(1.0, 0.1, step(0.5, v_notUsed));
}