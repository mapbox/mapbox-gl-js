#define HALF_PI PI / 2.0
#define QUARTER_PI PI / 4.0
#define RAD_TO_DEG 180.0 / PI
#define DEG_TO_RAD PI / 180.0
#define GLOBE_RADIUS EXTENT / PI / 2.0

uniform mat4 u_proj_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;
uniform mat3 u_grid_matrix;
uniform mat4 u_denormed_globe_matrix;

#ifdef GLOBE_POLES
attribute vec3 a_globe_pos;
attribute vec2 a_merc_pos;
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
    vec2 merc_pos = a_merc_pos;
    vec2 uv = a_uv;
#else
    float tiles = u_grid_matrix[0][2];
    float idy = u_grid_matrix[1][2];
    float S = u_grid_matrix[2][2];

    vec3 latLng = u_grid_matrix * vec3(a_pos, 1.0);

    float mercatorY = mercatorYfromLat(latLng[0]);
    float uvY = mercatorY * tiles - idy;
    
    float mercatorX = mercatorXfromLng(latLng[1]);
    float uvX = a_pos[0] * S;

    vec3 globe_pos = latLngToECEF(latLng.xy);
    vec2 merc_pos = vec2(mercatorX, mercatorY);
    vec2 uv = vec2(uvX, uvY);
#endif

    v_pos0 = uv;

    uv = uv * EXTENT;
    vec4 up_vector = vec4(elevationVector(uv), 1.0);
    float height = elevation(uv);

#ifdef TERRAIN_WIREFRAME
    height += wireframeOffset;
#endif

#ifdef GLOBE_POLES
    vec4 globe = u_globe_matrix * vec4(globe_pos + up_vector.xyz * height, 1.0);
#else
    vec4 elevation_offset = u_globe_matrix * vec4(up_vector.xyz * height, 0.0);
    vec4 globe = u_denormed_globe_matrix * vec4(globe_pos, 1.0);
    globe += elevation_offset;
#endif

    vec4 mercator = vec4(0.0);
    if (u_zoom_transition > 0.0) {
        mercator = vec4(merc_pos, height, 1.0);
        mercator.xy -= u_merc_center;
        mercator.x = wrap(mercator.x, -0.5, 0.5);
        mercator = u_merc_matrix * mercator;
    }

    vec3 position = mix(globe.xyz, mercator.xyz, u_zoom_transition);

    gl_Position = u_proj_matrix * vec4(position, 1.0);
}
