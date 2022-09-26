uniform mat4 u_matrix;
uniform float u_skirt_height;
uniform float u_smooth_distance;
uniform float u_offset;
uniform int u_linear;

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

float circle(vec2 uv, float radius) {
    if (u_linear == 0) {
        vec2 dist = uv - vec2(0.5, u_offset);
        float blur = 0.5;
        return smoothstep(radius - (radius * blur), radius + (radius * blur), dot(dist,dist)*4.0);
    } else {
        vec2 dist = uv - vec2(0.5);
        float blur = 0.5;
        return smoothstep(0.0, u_smooth_distance, uv.y - u_offset);
    }
}

void main() {
    v_pos0 = a_texture_pos / 8192.0;
    float skirt = float(a_pos.x >= skirtOffset);
    float elevation = elevation(a_texture_pos) - skirt * u_skirt_height;
#ifdef TERRAIN_WIREFRAME
    elevation += u_skirt_height * u_skirt_height * wireframeOffset;
#endif
    vec2 decodedPos = a_pos - vec2(skirt * skirtOffset, 0.0);

    vec4 position = u_matrix * vec4(decodedPos, 0.0, 1.0);
    vec2 uv = (position.xy / position.w) * 0.5 + 0.5;
    float popup = circle(uv, 0.5 * u_smooth_distance);
    gl_Position = u_matrix * vec4(decodedPos, elevation * popup, 1.0);

#ifdef FOG
    v_fog_opacity = fog(fog_position(vec3(decodedPos, elevation)));
#endif

#ifdef RENDER_SHADOWS
    vec3 pos = vec3(decodedPos, elevation);
    v_pos_light_view_0 = u_light_matrix_0 * vec4(pos, 1.);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(pos, 1.);
    v_depth = gl_Position.w;
#endif
}
