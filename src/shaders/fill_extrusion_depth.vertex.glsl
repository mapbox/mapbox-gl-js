uniform mat4 u_matrix;

attribute vec4 a_pos_normal_ed;
attribute vec2 a_centroid_pos;

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height

varying highp float v_depth;

void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height

    vec3 pos_nx = floor(a_pos_normal_ed.xyz * 0.5);
    // The least significant bits of a_pos_normal_ed.xy hold:
    // x is 1 if it's on top, 0 for ground.
    // y is 1 if the normal points up, and 0 if it points to side.
    // z is sign of ny: 1 for positive, 0 for values <= 0.
    mediump vec3 top_up_ny = a_pos_normal_ed.xyz - 2.0 * pos_nx;

    float x_normal = pos_nx.z / 8192.0;
    vec3 normal = top_up_ny.y == 1.0 ? vec3(0.0, 0.0, 1.0) : normalize(vec3(x_normal, (2.0 * top_up_ny.z - 1.0) * (1.0 - abs(x_normal)), 0.0));

    base = max(0.0, base);
    height = max(0.0, height);

    float t = top_up_ny.x;

    vec2 centroid_pos = vec2(0.0);
#if defined(HAS_CENTROID) || defined(TERRAIN)
    centroid_pos = a_centroid_pos;
#endif

#ifdef TERRAIN
    bool flat_roof = centroid_pos.x != 0.0 && t > 0.0;
    float ele = elevation(pos_nx.xy);
    float c_ele = flat_roof ? centroid_pos.y == 0.0 ? elevationFromUint16(centroid_pos.x) : flatElevation(centroid_pos) : ele;
    // If centroid elevation lower than vertex elevation, roof at least 2 meters height above base.
    float h = flat_roof ? max(c_ele + height, ele + base + 2.0) : ele + (t > 0.0 ? height : base);
    vec3 pos = vec3(pos_nx.xy, h);
#else
    vec3 pos = vec3(pos_nx.xy, t > 0.0 ? height : base);
#endif

    float hidden = float(centroid_pos.x == 0.0 && centroid_pos.y == 1.0);
    gl_Position = mix(u_matrix * vec4(pos, 1), AWAY, hidden);
    v_depth = gl_Position.z / gl_Position.w;
}
