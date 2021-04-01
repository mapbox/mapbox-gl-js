uniform mat4 u_matrix;
uniform float u_skirt_height;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos0;

const float skirtOffset = 24575.0;
const float wireframeOffset = 0.00015;

void main() {
    v_pos0 = a_texture_pos / 8192.0;
    float skirt = float(a_pos.x >= skirtOffset);
    float elevation = elevation(a_texture_pos) - skirt * u_skirt_height;
#ifdef TERRAIN_WIREFRAME
    elevation += u_skirt_height * u_skirt_height * wireframeOffset;
#endif
    vec2 decodedPos = a_pos - vec2(skirt * skirtOffset, 0.0);
    gl_Position = u_matrix * vec4(decodedPos, elevation, 1.0);
}
