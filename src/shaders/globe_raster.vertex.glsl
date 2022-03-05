#define CALCULATE_GLOBE_PROPERTIES 1
#define GLOBE_VERTEX_GRID_SIZE 64.0 // TODO: Perhaps pass the reciprocal as a uniform?

uniform mat4 u_proj_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;

#ifdef CALCULATE_GLOBE_PROPERTIES
uniform vec4 u_tile_bounds;
uniform vec2 u_size_y;
attribute vec2 a_pos;
#else
attribute vec3 a_globe_pos;
attribute vec2 a_merc_pos;
attribute vec2 a_uv;
#endif

#define HALF_PI PI / 2.0
#define QUARTER_PI PI / 4.0
#define RAD_TO_DEG 180.0 / PI
#define DEG_TO_RAD PI / 180.0
#define GLOBE_RADIUS EXTENT / PI / 2.0

varying vec2 v_pos0;

const float wireframeOffset = 1e3;

float mercatorXfromLng(float lng) {
    return (180.0 + lng) / 360.0;
}

float mercatorYfromLat(float lat) {
    return (180.0 - (RAD_TO_DEG* log(tan(QUARTER_PI + lat / 2.0 * DEG_TO_RAD)))) / 360.0;
}

vec3 latLngToECEF(float lat, float lng) {
    lat = DEG_TO_RAD * lat;
    lng = DEG_TO_RAD * lng;
    
    float cosLat = cos(lat);
    float sinLat = sin(lat);
    float cosLng = cos(lng);
    float sinLng = sin(lng);

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    float sx = cosLat * sinLng * GLOBE_RADIUS;
    float sy = -sinLat * GLOBE_RADIUS;
    float sz = cosLat * cosLng * GLOBE_RADIUS;

    return vec3(sx, sy, sz);
}

void main() {
#ifdef CALCULATE_GLOBE_PROPERTIES
    float top = u_tile_bounds[0];
    float bottom = u_tile_bounds[2];
    float left = u_tile_bounds[1];
    float right = u_tile_bounds[3];

    float tiles = u_size_y[0];
    float idy = u_size_y[1];

    float x = a_pos[0] / GLOBE_VERTEX_GRID_SIZE;
    float y = a_pos[1] / GLOBE_VERTEX_GRID_SIZE;
    
    float lat = mix(top, bottom, y);
    float mercatorY = mercatorYfromLat(lat);
    float uvY = mercatorY * tiles - idy;
    
    float lng = mix(left, right, x);
    float mercatorX = mercatorXfromLng(lng);
    float uvX = x;

    vec3 a_globe_pos = latLngToECEF(lat, lng);
    vec2 a_merc_pos = vec2(mercatorX, mercatorY);
    vec2 a_uv = vec2(uvX, uvY);
#endif

    v_pos0 = a_uv;

    vec2 uv = a_uv * EXTENT;
    vec4 up_vector = vec4(elevationVector(uv), 1.0);
    float height = elevation(uv);

#ifdef TERRAIN_WIREFRAME
    height += wireframeOffset;
#endif

    vec4 globe = u_globe_matrix * vec4(a_globe_pos + up_vector.xyz * height, 1.0);

    vec4 mercator = vec4(0.0);
    if (u_zoom_transition > 0.0) {
        mercator = vec4(a_merc_pos, height, 1.0);
        mercator.xy -= u_merc_center;
        mercator.x = wrap(mercator.x, -0.5, 0.5);
        mercator = u_merc_matrix * mercator;
    }

    vec3 position = mix(globe.xyz, mercator.xyz, u_zoom_transition);

    gl_Position = u_proj_matrix * vec4(position, 1.0);
}
