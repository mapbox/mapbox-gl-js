#include <mbgl/shader/circle_shader.hpp>
#include <mbgl/shader/circle.vertex.hpp>
#include <mbgl/shader/circle.fragment.hpp>
#include <mbgl/gl/gl.hpp>

#include <cstdio>

using namespace mbgl;

CircleShader::CircleShader(gl::GLObjectStore& glObjectStore)
    : Shader("circle", shaders::circle::vertex, shaders::circle::fragment, glObjectStore) {
}

void CircleShader::bind(GLbyte* offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 4, offset));
}
