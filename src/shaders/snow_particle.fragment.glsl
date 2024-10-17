in highp vec2 uv;
in highp float alphaMultiplier;

uniform vec4 u_particleColor;
uniform vec2 u_simpleShapeParameters;
// .x - simple shape fade start
// .y - simple shape fade power

void main() {
    float t = clamp((length(uv) - u_simpleShapeParameters.x) / (1.0 - u_simpleShapeParameters.x), 0.0, 1.0);
    float alpha = 1.0 - pow(t, pow(10.0, u_simpleShapeParameters.y));

    alpha *= alphaMultiplier;
    alpha *= u_particleColor.a;

    vec3 color = u_particleColor.rgb * alpha;
    glFragColor = vec4(color, alpha) ;

    HANDLE_WIREFRAME_DEBUG;
}
