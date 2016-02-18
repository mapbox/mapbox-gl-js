#include <mbgl/shader/sdf_shader.hpp>
#include <mbgl/shader/sdf.vertex.hpp>
#include <mbgl/shader/sdf.fragment.hpp>
#include <mbgl/gl/gl.hpp>

#include <cstdio>

using namespace mbgl;

SDFShader::SDFShader(gl::GLObjectStore& glObjectStore)
    : Shader("sdf", shaders::sdf::vertex, shaders::sdf::fragment, glObjectStore) {
    a_offset = MBGL_CHECK_ERROR(glGetAttribLocation(getID(), "a_offset"));
    a_data1 = MBGL_CHECK_ERROR(glGetAttribLocation(getID(), "a_data1"));
    a_data2 = MBGL_CHECK_ERROR(glGetAttribLocation(getID(), "a_data2"));
}

void SDFGlyphShader::bind(GLbyte* offset) {
    const int stride = 16;

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, stride, offset + 0));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_offset));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_offset, 2, GL_SHORT, false, stride, offset + 4));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_data1));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_data1, 4, GL_UNSIGNED_BYTE, false, stride, offset + 8));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_data2));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_data2, 4, GL_UNSIGNED_BYTE, false, stride, offset + 12));
}

void SDFIconShader::bind(GLbyte* offset) {
    const int stride = 16;

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, stride, offset + 0));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_offset));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_offset, 2, GL_SHORT, false, stride, offset + 4));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_data1));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_data1, 4, GL_UNSIGNED_BYTE, false, stride, offset + 8));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_data2));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_data2, 4, GL_UNSIGNED_BYTE, false, stride, offset + 12));
}
