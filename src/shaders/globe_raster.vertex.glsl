uniform mat4 u_proj_matrix;
uniform mat4 u_globe_matrix;
uniform mat4 u_merc_matrix;
uniform float u_zoom_transition;
uniform vec2 u_merc_center;

attribute vec3 a_globe_pos;
attribute vec2 a_merc_pos;
attribute vec2 a_uv;

varying vec2 v_pos0;

const float wireframeOffset = 1e3;

void main() {
    v_pos0 = a_uv;

    vec2 uv = a_uv * EXTENT;
    vec4 up_vector = vec4(elevationVector(uv), 1.0);
    float height = elevation(uv);

#ifdef TERRAIN_WIREFRAME
    height += wireframeOffset;
#endif

    vec3 globe = a_globe_pos + up_vector.xyz * height;
    vec4 globe_world = u_globe_matrix * vec4(globe, 1.0);

    vec4 mercator_world = vec4(0.0);
    vec3 mercator = vec3(0.0);
    if (u_zoom_transition > 0.0) {
        mercator = vec3(a_merc_pos, height);
        mercator.xy -= u_merc_center;
        mercator.x = wrap(mercator.x, -0.5, 0.5);
        mercator_world = u_merc_matrix * vec4(mercator, 1.0);
    }

    vec3 position = mix(globe_world.xyz, mercator_world.xyz, u_zoom_transition);

    gl_Position = u_proj_matrix * vec4(position, 1.0);

#ifdef FOG
    v_fog_pos = fog_position(globe);
#endif
}
