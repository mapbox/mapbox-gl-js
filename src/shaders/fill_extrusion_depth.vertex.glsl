uniform mat4 u_matrix;
uniform float u_edge_radius;

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

    base = max(0.0, base);
    height = max(0.0, top_up_ny.y == 0.0 && top_up_ny.x == 1.0 ? height - u_edge_radius : height);

    float t = top_up_ny.x;

    vec2 centroid_pos = vec2(0.0);
#if defined(HAS_CENTROID) || defined(TERRAIN)
    centroid_pos = a_centroid_pos;
#endif

vec3 pos;
#ifdef TERRAIN
    bool flat_roof = centroid_pos.x != 0.0 && t > 0.0;
    float ele = elevation(pos_nx.xy);
    float c_ele = flat_roof ? centroid_pos.y == 0.0 ? elevationFromUint16(centroid_pos.x) : flatElevation(centroid_pos) : ele;
    // If centroid elevation lower than vertex elevation, roof at least 2 meters height above base.
    float h = flat_roof ? max(c_ele + height, ele + base + 2.0) : ele + (t > 0.0 ? height : base);
    pos = vec3(pos_nx.xy, h);
#else
    pos = vec3(pos_nx.xy, t > 0.0 ? height : base);
#endif

    float hidden = float(centroid_pos.x == 0.0 && centroid_pos.y == 1.0);
    gl_Position = mix(u_matrix * vec4(pos, 1), AWAY, hidden);
    v_depth = gl_Position.z / gl_Position.w;
}
