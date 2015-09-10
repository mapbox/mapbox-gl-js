#ifndef MBGL_SHADER_SHADER_ICON
#define MBGL_SHADER_SHADER_ICON

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class IconShader : public Shader {
public:
    IconShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>                u_matrix      = {"u_matrix",      *this};
    UniformMatrix<4>                u_exmatrix    = {"u_exmatrix",    *this};
    Uniform<GLfloat>                u_zoom        = {"u_zoom",        *this};
    Uniform<GLfloat>                u_fadedist    = {"u_fadedist",    *this};
    Uniform<GLfloat>                u_minfadezoom = {"u_minfadezoom", *this};
    Uniform<GLfloat>                u_maxfadezoom = {"u_maxfadezoom", *this};
    Uniform<GLfloat>                u_fadezoom    = {"u_fadezoom",    *this};
    Uniform<GLfloat>                u_opacity     = {"u_opacity",     *this};
    Uniform<std::array<GLfloat, 2>> u_texsize     = {"u_texsize",     *this};
    Uniform<GLint>                  u_skewed      = {"u_skewed",      *this};
    Uniform<GLfloat>                u_extra       = {"u_extra",       *this};

protected:
    GLint a_offset = -1;
    GLint a_data1 = -1;
    GLint a_data2 = -1;
};

}

#endif
