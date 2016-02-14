#include <mbgl/shader/box_shader.hpp>
#include <mbgl/shader/box.vertex.hpp>
#include <mbgl/shader/box.fragment.hpp>
#include <mbgl/gl/gl.hpp>

#include <cstdio>

using namespace mbgl;

CollisionBoxShader::CollisionBoxShader()
    : Shader("collisionbox", shaders::box::vertex, shaders::box::fragment) {
    a_extrude = MBGL_CHECK_ERROR(glGetAttribLocation(getID(), "a_extrude"));
    a_data = MBGL_CHECK_ERROR(glGetAttribLocation(getID(), "a_data"));
}

void CollisionBoxShader::bind(GLbyte *offset) {
    const GLint stride = 12;

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, stride, offset + 0));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_extrude));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_extrude, 2, GL_SHORT, false, stride, offset + 4));

    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_data));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_data, 2, GL_UNSIGNED_BYTE, false, stride, offset + 8));

}
