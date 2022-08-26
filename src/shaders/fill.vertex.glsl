attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform float u_animation_time;

varying vec2 test_uv;
varying float depth;
varying float elevation;

// rand func from theartofcode (youtube channel)
vec2 rand01(vec2 p) {
    vec3 a = fract(p.xyx * vec3(123.5, 234.34, 345.65));
    a += dot(a, a+34.45);
    
    return fract (vec2(a.x * a.y, a.y * a.z));
}

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    test_uv = a_pos / vec2(8192.0);

    float timeA = (sin(u_animation_time * 0.1) + 1.0) / 2.0;
    float timeAP = 1.0 - abs(sin(u_animation_time * 0.1));
    float timeB = (sin(3.14 + u_animation_time * 0.1) + 1.0) / 2.0;
    float timeBP = 1.0 - abs(sin(3.14 + u_animation_time * 0.1));
    float timeC = (sin(3.14 * 0.5 + u_animation_time * 0.1) + 1.0) / 2.0;
    float timeCP = 1.0 - abs(sin(3.14 * 0.5 + u_animation_time * 0.1));

    vec2 pointA = vec2(0.5 + 0.4 * timeA, 0.5 - 0.2 * timeA);
    vec2 pointB = vec2(0.25 + 0.4 * timeB, 0.25 + 0.3 * timeB);
    vec2 pointC = vec2(0.65 + 0.2 * timeC, 0.5 - 0.2 * timeC);

    float distA = (1.0 - min(length(test_uv - pointA) * 3.0, 1.0));
    distA *= test_uv.y < pointA.y ? 1.5 : 0.85;
    float distB = (1.0 - min(length(test_uv - pointB) * 3.0, 1.0));
    distB *= test_uv.y < pointB.y ? 1.5 : 0.85;
    float distC = (1.0 - min(length(test_uv - pointC) * 3.0, 1.0));
    distC *= test_uv.y < pointC.y ? 1.5 : 0.85;
    
    elevation = (distA * 3.0 * timeAP) + (distB * 3.0 * timeBP) + (distC * 6.0 * timeCP);

    gl_Position = u_matrix * vec4(a_pos, elevation, 1);

    depth = 0.0;
#ifdef FOG
    v_fog_pos = fog_position(a_pos);
    depth = length(fog_position(a_pos));
#endif
}
