attribute vec3 a_pos;
attribute vec2 a_uv;

void main() {
    gl_Position = vec4(a_pos, 1.0);
}