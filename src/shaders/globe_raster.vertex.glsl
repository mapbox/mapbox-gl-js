uniform mat4 u_globe_matrix;
uniform mat4 u_mercator_matrix;
uniform float u_transition_lerp;
uniform float u_skirt_height;

uniform vec3 u_tl_normal;
uniform vec3 u_tr_normal;
uniform vec3 u_br_normal;
uniform vec3 u_bl_normal;

uniform float u_top_meters_to_pixels;
uniform float u_bottom_meters_to_pixels;

attribute vec3 a_globe_pos;
attribute vec2 a_uv;
attribute vec2 a_pos;           // Mercator
attribute vec2 a_texture_pos;

varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

const float skirtOffset = 24575.0;
const float wireframeOffset = 0.00015;

void main() {
    //v_pos0 = a_uv;
    //v_pos0 = a_texture_pos / 8192.0;
    v_pos0 = mix(a_uv, a_texture_pos / 8192.0, u_transition_lerp);

    // Bilinear interpolation over normals of corner points
    vec3 normal = normalize(mix(
        mix(u_tl_normal, u_tr_normal, a_uv.xxx),
        mix(u_bl_normal, u_br_normal, a_uv.xxx),
        a_uv.yyy));

    float elevation = elevation(a_uv * 8192.0);
    float meters_to_pixels = mix(u_top_meters_to_pixels, u_bottom_meters_to_pixels, a_uv.y);

    vec4 globePos = u_globe_matrix * vec4(a_globe_pos + normal * elevation * meters_to_pixels, 1.0);
    vec4 mercPos = u_mercator_matrix * vec4(a_pos, 0.0, 1.0);

    //gl_Position = globePos;
    //gl_Position = mercPos;
    gl_Position = mix(globePos, mercPos, u_transition_lerp);
}
