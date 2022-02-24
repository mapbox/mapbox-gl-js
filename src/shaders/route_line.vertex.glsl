uniform mat4 u_matrix;
uniform float u_scale_1f;

attribute vec3 a_pos_3f;
attribute vec3 a_center_3f;
attribute vec3 a_fwd_3f;

varying vec3 v_normal;
varying vec3 v_fwd;

void main() {
    vec3 n = a_pos_3f - a_center_3f;

    // Vertex normal should be orthogonal with the forward vector
    v_normal = normalize(n - dot(n, a_fwd_3f) * a_fwd_3f);

    v_fwd = a_fwd_3f;

    gl_Position = u_matrix * vec4(a_center_3f + n * u_scale_1f, 1.0);
}