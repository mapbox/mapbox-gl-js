precision mediump float;

#define scale 63.0
#define root2 1.42

uniform mat4 u_posmatrix;
uniform vec2 u_size;
uniform mat2 u_rotationmatrix;

attribute vec2 a_pos;
attribute vec2 a_slope;
varying mat2 v_rotationmatrix;

void main(void) {

    gl_Position = u_posmatrix * vec4(floor(a_pos/2.0), 0, 1);
    gl_PointSize = u_size.x * root2;

    float angle = atan(a_slope.y, a_slope.x);

    v_rotationmatrix = mat2(
        cos(angle), -sin(angle),
        sin(angle), cos(angle)
    ) * u_rotationmatrix;
}
