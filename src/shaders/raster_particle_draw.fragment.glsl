precision highp float;

uniform sampler2D u_color_ramp;

in float v_particle_speed;

void main() {
    glFragColor = texture(u_color_ramp, vec2(v_particle_speed, 0.5));
}
