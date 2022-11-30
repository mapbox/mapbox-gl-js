uniform mat4 u_matrix;
uniform float u_skirt_height;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos0;

#ifdef FOG
varying float v_fog_opacity;
#endif

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;
varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;
#endif

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

#ifdef FOG
#ifdef ZERO_EXAGGERATION
    v_fog_pos = fog_position(decodedPos);
#else
    v_fog_opacity = fog(fog_position(vec3(decodedPos, elevation)));
#endif
#endif

#ifdef RENDER_SHADOWS
    vec3 pos = vec3(decodedPos, elevation);
    v_pos_light_view_0 = u_light_matrix_0 * vec4(pos, 1.);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(pos, 1.);
    v_depth = gl_Position.w;
#endif
}
