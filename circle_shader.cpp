#include <mbgl/shader/circle_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

CircleShader::CircleShader()
    : Shader(
        "circle",
        shaders[CIRCLE_SHADER].vertex,
        shaders[CIRCLE_SHADER].fragment
    ) {
}

void CircleShader::bind(GLbyte *offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 4, offset));
}
