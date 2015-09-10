#include <mbgl/shader/dot_shader.hpp>
#include <mbgl/shader/shaders.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

DotShader::DotShader()
: Shader(
         "dot",
         shaders[DOT_SHADER].vertex,
         shaders[DOT_SHADER].fragment
         ) {
}

void DotShader::bind(GLbyte *offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 8, offset));
}
