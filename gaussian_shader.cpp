#include <mbgl/shader/gaussian_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

GaussianShader::GaussianShader()
    : Shader(
         "gaussian",
         shaders[GAUSSIAN_SHADER].vertex,
         shaders[GAUSSIAN_SHADER].fragment
         ) {
    a_pos = MBGL_CHECK_ERROR(glGetAttribLocation(program, "a_pos"));
}

void GaussianShader::bind(char *offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
