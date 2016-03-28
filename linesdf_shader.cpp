#include <mbgl/shader/linesdf_shader.hpp>
#include <mbgl/shader/linesdf.vertex.hpp>
#include <mbgl/shader/linesdf.fragment.hpp>
#include <mbgl/gl/gl.hpp>

#include <cstdio>

using namespace mbgl;

LineSDFShader::LineSDFShader(gl::GLObjectStore& glObjectStore)
    : Shader("line", shaders::linesdf::vertex, shaders::linesdf::fragment, glObjectStore) {
    a_data = MBGL_CHECK_ERROR(glGetAttribLocation(getID(), "a_data"));
}

void LineSDFShader::bind(GLbyte* offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 8, offset + 0));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_data));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_data, 4, GL_UNSIGNED_BYTE, false, 8, offset + 4));
}
