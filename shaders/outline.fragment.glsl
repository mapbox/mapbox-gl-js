precision mediump float;

uniform lowp vec4 u_color;
uniform lowp float u_opacity;

varying vec2 v_pos;

void main() {
    float dist = length(v_pos - gl_FragCoord.xy);
    float alpha = smoothstep(1.0, 0.0, dist);
    gl_FragColor = u_color * (alpha * u_opacity);
}
