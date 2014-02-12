precision mediump float;

#define scale 63.0
#define root2 1.42

uniform mat4 u_posmatrix;
uniform vec2 u_size;
uniform mat2 u_rotationmatrix;

attribute vec2 a_pos;
attribute float a_angle;

varying mat2 v_rotationmatrix;

void main(void) {

    gl_Position = u_posmatrix * vec4(floor(a_pos/2.0), 0, 1);
    gl_PointSize = u_size.x * root2;

    v_rotationmatrix = mat2(
        cos(a_angle), -sin(a_angle),
        sin(a_angle), cos(a_angle)
    ) * u_rotationmatrix;
}
