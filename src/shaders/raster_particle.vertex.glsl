#include "_prelude_fog.vertex.glsl"

uniform mat4 u_matrix;
uniform mat4 u_normalize_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform mat3 u_grid_matrix;
uniform vec2 u_tl_parent;
uniform float u_scale_parent;
uniform float u_raster_elevation;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;

#define GLOBE_UPSCALE GLOBE_RADIUS / 6371008.8

in vec2 a_pos;
in vec2 a_texture_pos;

out vec2 v_pos0;
out vec2 v_pos1;

void main() {
    float w = 1.0;
#ifdef PROJECTION_GLOBE_VIEW
    vec3 decomposed_pos_and_skirt = decomposeToPosAndSkirt(a_pos);
    vec3 latLng = u_grid_matrix * vec3(decomposed_pos_and_skirt.xy, 1.0);
    float mercatorY = mercatorYfromLat(latLng[0]);
    float mercatorX = mercatorXfromLng(latLng[1]);

    // The 3rd row of u_grid_matrix is only used as a spare space to 
    // pass the following 3 uniforms to avoid explicitly introducing new ones.
    float tiles = u_grid_matrix[0][2];
    float idx = u_grid_matrix[1][2];
    float idy = u_grid_matrix[2][2];
    float uvX = mercatorX * tiles - idx;
    float uvY = mercatorY * tiles - idy;
    vec2 uv = vec2(uvX, uvY);

    vec3 globe_pos = latLngToECEF(latLng.xy);
    globe_pos += normalize(globe_pos) * u_raster_elevation * GLOBE_UPSCALE;
    vec4 globe_world_pos = u_globe_matrix * vec4(globe_pos, 1.0);
    vec4 merc_world_pos = vec4(0.0);
    if (u_zoom_transition > 0.0) {
        vec2 merc_pos = vec2(mercatorX, mercatorY);
        merc_world_pos = vec4(merc_pos, u_raster_elevation, 1.0);
        merc_world_pos.xy -= u_merc_center;
        merc_world_pos.x = wrap(merc_world_pos.x, -0.5, 0.5);
        merc_world_pos = u_merc_matrix * merc_world_pos;
    }

    vec4 interpolated_pos = vec4(mix(globe_world_pos.xyz, merc_world_pos.xyz, u_zoom_transition) * w, w);

    gl_Position = u_matrix * interpolated_pos;
#ifdef FOG
    v_fog_pos = fog_position((u_normalize_matrix * vec4(globe_pos, 1.0)).xyz);
#endif // FOG
#else // else PROJECTION_GLOBE_VIEW
    // We are using Int16 for texture position coordinates to give us enough precision for
    // fractional coordinates. We use 8192 to scale the texture coordinates in the buffer
    // as an arbitrarily high number to preserve adequate precision when rendering.
    // This is also the same value as the EXTENT we are using for our tile buffer pos coordinates,
    // so math for modifying either is consistent.
    vec2 uv = a_texture_pos / 8192.0;
    gl_Position = u_matrix * vec4(a_pos * w, u_raster_elevation * w, w);
#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif // FOG
#endif // endif PROJECTION_GLOBE_VIEW

    v_pos0 = uv;
    v_pos1 = (v_pos0 * u_scale_parent) + u_tl_parent;
}
