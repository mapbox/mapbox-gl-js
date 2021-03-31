uniform mat4 u_matrix;
uniform float u_skirt_height;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

#ifdef FOG
varying vec3 v_fog_pos;
#endif

const float skirtOffset = 24575.0;

void main() {
    float skirt = float(a_pos.x >= skirtOffset);
    float elevation = elevation(a_texture_pos) - skirt * u_skirt_height;

    vec2 decodedPos = a_pos - vec2(skirt * skirtOffset, 0.0);
    gl_Position = u_matrix * vec4(decodedPos, elevation, 1.0);
#ifdef FOG
    v_fog_pos = fog_position(vec3(decodedPos, elevation));
#endif
}
