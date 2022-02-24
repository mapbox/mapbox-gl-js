#ifdef GL_ES
precision highp float;
#endif

uniform vec3 u_camera_fwd;
uniform vec4 u_inner_color;
uniform vec4 u_outer_color;

varying vec3 v_normal;
varying vec3 v_fwd;

void main() {
    // Main color of the route line
    vec3 projNormal = normalize(dot(u_camera_fwd, v_fwd) * v_fwd - u_camera_fwd);

    float t = smoothstep(0.50, 1.0, dot(projNormal, v_normal));
    gl_FragColor = mix(u_outer_color, u_inner_color, t);
}