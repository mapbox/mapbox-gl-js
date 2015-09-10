#include <mbgl/shader/plain_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

PlainShader::PlainShader()
    : Shader(
        "plain",
        shaders[PLAIN_SHADER].vertex,
        shaders[PLAIN_SHADER].fragment
    ) {
}

void PlainShader::bind(char *offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
