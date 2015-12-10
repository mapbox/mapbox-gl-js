#include <mbgl/shader/outline_shader.hpp>
#include <mbgl/shader/outline.vertex.hpp>
#include <mbgl/shader/outline.fragment.hpp>
#include <mbgl/platform/gl.hpp>

#include <cstdio>

using namespace mbgl;

OutlineShader::OutlineShader()
    : Shader("outline", shaders::outline::vertex, shaders::outline::fragment) {
}

void OutlineShader::bind(GLbyte* offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
