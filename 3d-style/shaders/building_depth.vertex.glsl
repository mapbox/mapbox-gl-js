in ivec2 a_pos_packed;

uniform mat4 u_matrix;

void main() {
    vec3 pos = vec3(float(a_pos_packed.x >> 16), float((a_pos_packed.x << 16) >> 16), intBitsToFloat(a_pos_packed.y));
    gl_Position = u_matrix * vec4(pos, 1.0);
}
