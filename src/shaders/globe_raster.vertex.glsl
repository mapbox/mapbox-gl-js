uniform mat4 u_globe_matrix;
uniform float u_skirt_height;

attribute vec3 a_globe_pos;
attribute vec2 a_uv;

varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

const float skirtOffset = 24575.0;
const float wireframeOffset = 0.00015;

void main() {
    v_pos0 = a_uv;
    gl_Position = u_globe_matrix * vec4(a_globe_pos + elevationVector(a_uv * 8192.0) * elevation(a_uv * 8192.0), 1.0);
}
