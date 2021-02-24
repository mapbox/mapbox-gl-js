uniform mat4 u_matrix;
uniform mat4 u_lighting_matrix;
uniform float u_skirt_height;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos0;
varying float v_distance;
varying vec3 v_position;

const float skirtOffset = 24575.0;

void main() {
    v_pos0 = a_texture_pos / 8192.0;
    float skirt = float(a_pos.x >= skirtOffset);
    float elevation = elevation(a_texture_pos) - skirt * u_skirt_height;
    vec2 decodedPos = a_pos - vec2(skirt * skirtOffset, 0.0);
    gl_Position = u_matrix * vec4(decodedPos, elevation, 1.0);
    v_distance = length(gl_Position.xyz);
    vec4 position = u_lighting_matrix * vec4(decodedPos, elevation, 1.0);
    v_position = vec3(position.x/position.w, position.y/position.w, position.z/position.w);
}
//