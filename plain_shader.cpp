#include <mbgl/shader/plain_shader.hpp>
#include <mbgl/shader/plain.vertex.hpp>
#include <mbgl/shader/plain.fragment.hpp>
#include <mbgl/gl/gl.hpp>

#include <cstdio>

using namespace mbgl;

PlainShader::PlainShader(gl::GLObjectStore& glObjectStore)
    : Shader("plain", shaders::plain::vertex, shaders::plain::fragment, glObjectStore) {
}

void PlainShader::bind(GLbyte* offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
