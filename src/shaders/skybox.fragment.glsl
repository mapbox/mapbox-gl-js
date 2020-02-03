varying vec3 v_uv;

uniform samplerCube u_cubemap;

void main() {
    gl_FragColor = vec4(textureCube(u_cubemap, v_uv).rgb, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
