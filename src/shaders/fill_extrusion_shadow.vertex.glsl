uniform mat4 u_matrix;

attribute vec4 a_pos_normal_ed;
attribute vec2 a_lightmap_uv;

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height

#pragma mapbox: define highp vec4 color

//varying vec4 v_depth;

void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height
    #pragma mapbox: initialize highp vec4 color

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

    gl_Position = u_matrix * vec4(pos_nx.xy, t > 0.0 ? height : base, 1);
}