
varying float color_variation;
uniform float u_opacity;

void main() {
    gl_FragColor = vec4(vec3(color_variation * u_opacity), 1.0);
}