#include <mbgl/shader/outline_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

OutlineShader::OutlineShader()
    : Shader(
        "outline",
        shaders[OUTLINE_SHADER].vertex,
        shaders[OUTLINE_SHADER].fragment
    ) {
}

void OutlineShader::bind(GLbyte *offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
