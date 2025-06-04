in vec2 a_pos;
in float a_height;

uniform mat4 u_matrix;
uniform vec3 u_camera_pos;
uniform highp float u_depth_bias;
uniform lowp float u_height_scale;
uniform lowp float u_reset_depth;

#ifdef DEPTH_RECONSTRUCTION
out float v_height;
#endif

void main() {
    vec3 vpos = vec3(a_pos, a_height * u_height_scale);

#ifdef DEPTH_RECONSTRUCTION
    // Project vertex to z = 0 plane. Ignore vertices above the camera
    // as they would be projected behind the camera
    if (u_camera_pos.z > vpos.z) {
        vpos -= (u_camera_pos - vpos) * (vpos.z / (u_camera_pos.z - vpos.z));
    }

    v_height = a_height;
#endif

    gl_Position = u_matrix * vec4(vpos, 1);

    // Reset depth by setting z to 1, otherwise render with a slight bias
    gl_Position.z = u_reset_depth == 1.0 ? gl_Position.w : gl_Position.z + u_depth_bias;
}