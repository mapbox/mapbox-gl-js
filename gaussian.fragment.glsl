uniform sampler2D u_image;

varying vec2 v_coords[3];

void main() {
    vec4 sum = vec4(0.0);
    sum += texture2D(u_image, v_coords[0]) * 0.40261994689424746;
    sum += texture2D(u_image, v_coords[1]) * 0.2986900265528763;
    sum += texture2D(u_image, v_coords[2]) * 0.2986900265528763;
    gl_FragColor = sum;
}
