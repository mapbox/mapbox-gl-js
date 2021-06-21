uniform mat4 u_matrix;
uniform float u_skirt_height;

uniform vec3 u_tl_normal;
uniform vec3 u_tr_normal;
uniform vec3 u_br_normal;
uniform vec3 u_bl_normal;

uniform float u_top_meters_to_pixels;
uniform float u_bottom_meters_to_pixels;

attribute vec3 a_pos;
attribute vec2 a_uv;

varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

const float skirtOffset = 24575.0;
const float wireframeOffset = 0.00015;

void main() {
    v_pos0 = a_uv;

    // Bilinear interpolation over normals of corner points
    vec3 normal = normalize(mix(
        mix(u_tl_normal, u_tr_normal, a_uv.xxx),
        mix(u_bl_normal, u_br_normal, a_uv.xxx),
        a_uv.yyy));

    float meters_to_pixels = mix(u_top_meters_to_pixels, u_bottom_meters_to_pixels, a_uv.y);

    //float skirt = float(a_pos.x >= skirtOffset);
    float elevation = elevation(a_uv * 8192.0);// - skirt * u_skirt_height;
//#ifdef TERRAIN_WIREFRAME
//    elevation += u_skirt_height * u_skirt_height * wireframeOffset;
//#endif
    //vec2 decodedPos = a_pos - vec2(skirt * skirtOffset, 0.0);
    //gl_Position = u_matrix * vec4(decodedPos, 0, 1.0);
    gl_Position = u_matrix * vec4(a_pos + normal * elevation * meters_to_pixels, 1.0);

//#ifdef FOG
//    v_fog_opacity = fog(fog_position(vec3(decodedPos, 0)));
//#endif
}
