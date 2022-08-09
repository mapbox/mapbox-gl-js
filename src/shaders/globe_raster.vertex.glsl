uniform mat4 u_proj_matrix;
uniform mat4 u_normalize_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;
uniform mat3 u_grid_matrix;

#ifdef GLOBE_POLES
attribute vec3 a_globe_pos;
attribute vec2 a_uv;
#else
attribute vec2 a_pos;
#endif

varying vec2 v_pos0;

const float wireframeOffset = 1e3;

float mercatorXfromLng(float lng) {
    return (180.0 + lng) / 360.0;
}

float mercatorYfromLat(float lat) {
    return (180.0 - (RAD_TO_DEG* log(tan(QUARTER_PI + lat / 2.0 * DEG_TO_RAD)))) / 360.0;
}

vec3 latLngToECEF(vec2 latLng) {
    latLng = DEG_TO_RAD * latLng;
    
    float cosLat = cos(latLng[0]);
    float sinLat = sin(latLng[0]);
    float cosLng = cos(latLng[1]);
    float sinLng = sin(latLng[1]);

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    float sx = cosLat * sinLng * GLOBE_RADIUS;
    float sy = -sinLat * GLOBE_RADIUS;
    float sz = cosLat * cosLng * GLOBE_RADIUS;

    return vec3(sx, sy, sz);
}

void main() {
#ifdef GLOBE_POLES
    vec3 globe_pos = a_globe_pos;
    vec2 uv = a_uv;
#else
    // The 3rd row of u_grid_matrix is only used as a spare space to 
    // pass the following 3 uniforms to avoid explicitly introducing new ones.
    float tiles = u_grid_matrix[0][2];
    float idx = u_grid_matrix[1][2];
    float idy = u_grid_matrix[2][2];

    vec3 latLng = u_grid_matrix * vec3(a_pos, 1.0);

    float mercatorY = mercatorYfromLat(latLng[0]);
    float uvY = mercatorY * tiles - idy;
    
    float mercatorX = mercatorXfromLng(latLng[1]);
    float uvX = mercatorX * tiles - idx;

    vec3 globe_pos = latLngToECEF(latLng.xy);
    vec2 merc_pos = vec2(mercatorX, mercatorY);
    vec2 uv = vec2(uvX, uvY);
#endif

    v_pos0 = uv;
    vec2 tile_pos = uv * EXTENT;

#ifdef GLOBE_POLES
    // Normal vector can be derived from the ecef position
    // as "elevationVector" can't be queried outside of the tile
    vec3 up_vector = normalize(globe_pos) * u_tile_up_scale;
#else
    vec3 up_vector = elevationVector(tile_pos);
#endif
    float height = elevation(tile_pos);

#ifdef TERRAIN_WIREFRAME
    height += wireframeOffset;
#endif

    globe_pos += up_vector * height;

#ifdef GLOBE_POLES
    vec4 interpolated_pos = u_globe_matrix * vec4(globe_pos, 1.0);
#else
    vec4 globe_world_pos = u_globe_matrix * vec4(globe_pos, 1.0);
    vec4 merc_world_pos = vec4(0.0);
    if (u_zoom_transition > 0.0) {
        merc_world_pos = vec4(merc_pos, height, 1.0);
        merc_world_pos.xy -= u_merc_center;
        merc_world_pos.x = wrap(merc_world_pos.x, -0.5, 0.5);
        merc_world_pos = u_merc_matrix * merc_world_pos;
    }

    vec4 interpolated_pos = vec4(mix(globe_world_pos.xyz, merc_world_pos.xyz, u_zoom_transition), 1.0);
#endif

    gl_Position = u_proj_matrix * interpolated_pos;

#ifdef FOG
    v_fog_pos = fog_position((u_normalize_matrix * vec4(globe_pos, 1.0)).xyz);
#endif
}
