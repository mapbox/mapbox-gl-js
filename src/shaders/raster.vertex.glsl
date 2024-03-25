#include "_prelude_fog.vertex.glsl"

uniform mat4 u_matrix;
uniform mat4 u_normalize_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform mat3 u_grid_matrix;
uniform vec2 u_tl_parent;
uniform float u_scale_parent;
uniform vec2 u_perspective_transform;
uniform vec2 u_texture_offset;
uniform float u_raster_elevation;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;

#define GLOBE_UPSCALE GLOBE_RADIUS / 6371008.8

#ifdef GLOBE_POLES
in vec3 a_globe_pos;
in vec2 a_uv;
#else
in vec2 a_pos;
in vec2 a_texture_pos;
#endif

out vec2 v_pos0;
out vec2 v_pos1;
out float v_depth;
#ifdef PROJECTION_GLOBE_VIEW
out float v_split_fade;
#endif

void main() {
    vec2 uv;
#ifdef GLOBE_POLES
    vec3 globe_pos = a_globe_pos;
    globe_pos += normalize(globe_pos) * u_raster_elevation * GLOBE_UPSCALE;
    gl_Position = u_matrix * u_globe_matrix * vec4(globe_pos    , 1.0);
    uv = a_uv;
#ifdef FOG
    v_fog_pos = fog_position((u_normalize_matrix * vec4(a_globe_pos, 1.0)).xyz);
#endif // FOG
#else // else GLOBE_POLES
    float w = 1.0 + dot(a_texture_pos, u_perspective_transform);
    // We are using Int16 for texture position coordinates to give us enough precision for
    // fractional coordinates. We use 8192 to scale the texture coordinates in the buffer
    // as an arbitrarily high number to preserve adequate precision when rendering.
    // This is also the same value as the EXTENT we are using for our tile buffer pos coordinates,
    // so math for modifying either is consistent.
    uv = a_texture_pos / 8192.0;
#ifdef PROJECTION_GLOBE_VIEW
    vec3 decomposed_pos_and_skirt = decomposeToPosAndSkirt(a_pos);
    vec3 latLng = u_grid_matrix * vec3(decomposed_pos_and_skirt.xy, 1.0);
    vec3 globe_pos = latLngToECEF(latLng.xy);
    globe_pos += normalize(globe_pos) * u_raster_elevation * GLOBE_UPSCALE;
    vec4 globe_world_pos = u_globe_matrix * vec4(globe_pos, 1.0);
    vec4 merc_world_pos = vec4(0.0);
    float mercatorY = mercatorYfromLat(latLng[0]);
    float mercatorX = mercatorXfromLng(latLng[1]);    
    v_split_fade = 0.0;
    if (u_zoom_transition > 0.0) {
        vec2 merc_pos = vec2(mercatorX, mercatorY);
        merc_world_pos = vec4(merc_pos, u_raster_elevation, 1.0);
        merc_world_pos.xy -= u_merc_center;
        merc_world_pos.x = wrap(merc_world_pos.x, -0.5, 0.5);
        merc_world_pos = u_merc_matrix * merc_world_pos;

        float opposite_merc_center = mod(u_merc_center.x + 0.5, 1.0);
        float dist_from_poles = (abs(mercatorY - 0.5) * 2.0);
        float range = 0.1;
        v_split_fade = abs(opposite_merc_center - mercatorX);
        v_split_fade = clamp(1.0 - v_split_fade, 0.0, 1.0);
        v_split_fade = max(smoothstep(1.0 - range, 1.0, dist_from_poles), max(smoothstep(1.0 - range, 1.0, v_split_fade), smoothstep(1.0 - range, 1.0, 1.0 - v_split_fade)));
    }

    float tiles = u_grid_matrix[0][2];
    if (tiles > 0.0) {
        float idx = u_grid_matrix[1][2];
        float idy = u_grid_matrix[2][2];
        float uvY = mercatorY * tiles - idy;
        float uvX = mercatorX * tiles - idx;
        uv = vec2(uvX, uvY);
    }

    vec4 interpolated_pos = vec4(mix(globe_world_pos.xyz, merc_world_pos.xyz, u_zoom_transition) * w, w);

    gl_Position = u_matrix * interpolated_pos;
#ifdef FOG
    v_fog_pos = fog_position((u_normalize_matrix * vec4(globe_pos, 1.0)).xyz);
#endif // FOG
#else // else PROJECTION_GLOBE_VIEW
    gl_Position = u_matrix * vec4(a_pos * w, u_raster_elevation * w, w);
#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif // FOG
#endif // else PROJECTION_GLOBE_VIEW
#endif // else GLOBE_POLES

    v_pos0 = uv;
    v_pos1 = (v_pos0 * u_scale_parent) + u_tl_parent;

    // Correct the texture coord for a buffer, for example if tiles have a 1px buffer and
    // are therefore 258 x 258 or 514 x 514.
    v_pos0 = u_texture_offset.x + u_texture_offset.y * v_pos0;
    v_pos1 = u_texture_offset.x + u_texture_offset.y * v_pos1;

#ifdef RENDER_CUTOFF
    v_depth = gl_Position.z;
#endif
}
