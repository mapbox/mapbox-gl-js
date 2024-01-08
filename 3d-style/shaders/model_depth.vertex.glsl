in vec3 a_pos_3f;

uniform mat4 u_matrix;
out highp float v_depth;

#ifdef MODEL_POSITION_ON_GPU
#ifdef INSTANCED_ARRAYS
in vec4 a_normal_matrix0;
in vec4 a_normal_matrix1;
in vec4 a_normal_matrix2;
in vec4 a_normal_matrix3;
#else
uniform highp mat4 u_instance;
#endif
uniform highp mat4 u_node_matrix;
#endif

void main() {

#ifdef MODEL_POSITION_ON_GPU
    highp mat4 instance;
#ifdef INSTANCED_ARRAYS
    instance = mat4(a_normal_matrix0, a_normal_matrix1, a_normal_matrix2, a_normal_matrix3);
#else
    instance = u_instance;
#endif
    vec3 pos_color = instance[0].xyz;
    vec4 translate = instance[1];
    vec3 pos_a = floor(pos_color);

    float meter_to_tile = instance[0].w;
    vec4 pos = vec4(pos_a.xy, translate.z, 1.0);
    mat3 rs;
    rs[0].x = instance[1].w;
    rs[0].yz = instance[2].xy;
    rs[1].xy = instance[2].zw;
    rs[1].z = instance[3].x;
    rs[2].xyz = instance[3].yzw;

    vec4 pos_node = u_node_matrix * vec4(a_pos_3f, 1.0);
    vec3 rotated_pos_node = rs * pos_node.xyz;
    vec3 pos_model_tile = (rotated_pos_node + vec3(translate.xy, 0.0)) * vec3(meter_to_tile, meter_to_tile, 1.0);
    pos.xyz += pos_model_tile;

    gl_Position = u_matrix * pos;
#else
    gl_Position = u_matrix * vec4(a_pos_3f, 1);
#endif

    v_depth = gl_Position.z / gl_Position.w;
}
