uniform vec3 u_vignetteShape;
// .x - begin
// .y - range
// .z - power

uniform vec4 u_vignetteColor;


in vec2 st;

void main() {

    float screenDist = length(st);

    float alpha = clamp((screenDist - u_vignetteShape.x) / u_vignetteShape.y, 0.0, 1.0);
    alpha = pow(alpha, u_vignetteShape.z) * u_vignetteColor.a;

    vec3 color = u_vignetteColor.rgb;
    glFragColor = vec4(color * alpha, alpha) ;
}
