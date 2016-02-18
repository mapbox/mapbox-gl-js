#ifndef MBGL_SHADER_SDF_SHADER
#define MBGL_SHADER_SDF_SHADER

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class SDFShader : public Shader {
public:
    SDFShader(gl::GLObjectStore&);

    UniformMatrix<4>                u_matrix      = {"u_matrix",      *this};
    UniformMatrix<4>                u_exmatrix    = {"u_exmatrix",    *this};
    Uniform<std::array<GLfloat, 4>> u_color       = {"u_color",       *this};
    Uniform<std::array<GLfloat, 2>> u_texsize     = {"u_texsize",     *this};
    Uniform<GLfloat>                u_buffer      = {"u_buffer",      *this};
    Uniform<GLfloat>                u_gamma       = {"u_gamma",       *this};
    Uniform<GLfloat>                u_zoom        = {"u_zoom",        *this};
    Uniform<GLfloat>                u_fadedist    = {"u_fadedist",    *this};
    Uniform<GLfloat>                u_minfadezoom = {"u_minfadezoom", *this};
    Uniform<GLfloat>                u_maxfadezoom = {"u_maxfadezoom", *this};
    Uniform<GLfloat>                u_fadezoom    = {"u_fadezoom",    *this};
    Uniform<GLint>                  u_skewed      = {"u_skewed",      *this};
    Uniform<GLint>                  u_texture     = {"u_texture",     *this};

protected:
    GLint a_offset = -1;
    GLint a_data1 = -1;
    GLint a_data2 = -1;
};

class SDFGlyphShader : public SDFShader {
public:
    SDFGlyphShader(gl::GLObjectStore& glObjectStore) : SDFShader(glObjectStore) {}
    void bind(GLbyte *offset) final;
};

class SDFIconShader : public SDFShader {
public:
    SDFIconShader(gl::GLObjectStore& glObjectStore) : SDFShader(glObjectStore) {}
    void bind(GLbyte *offset) final;
};

} // namespace mbgl

#endif
