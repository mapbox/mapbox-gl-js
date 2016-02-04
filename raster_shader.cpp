#include <mbgl/shader/raster_shader.hpp>
#include <mbgl/shader/raster.vertex.hpp>
#include <mbgl/shader/raster.fragment.hpp>
#include <mbgl/gl/gl.hpp>

#include <cstdio>

using namespace mbgl;

RasterShader::RasterShader()
    : Shader("raster", shaders::raster::vertex, shaders::raster::fragment) {
}

void RasterShader::bind(GLbyte* offset) {
    MBGL_CHECK_ERROR(glEnableVertexAttribArray(a_pos));
    MBGL_CHECK_ERROR(glVertexAttribPointer(a_pos, 2, GL_SHORT, false, 0, offset));
}
