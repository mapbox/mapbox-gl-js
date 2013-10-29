#define root2 1.42
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_tl;
uniform vec2 u_br;

varying mat2 v_rotationmatrix;

void main(void) {

    vec2 pos = v_rotationmatrix * (gl_PointCoord * 2.0 - 1.0) * root2 / 2.0 + 0.5;

    float inbounds = step(0.0, pos.x) * step(0.0, pos.y) *
        (1.0 - step(1.0, pos.x)) * (1.0 - step(1.0, pos.y));

    gl_FragColor = texture2D(u_image, mix(u_tl, u_br, pos)) * inbounds;

    gl_FragColor.rgb *= gl_FragColor.a;
}
