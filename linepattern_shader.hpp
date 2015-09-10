#ifndef MBGL_SHADER_SHADER_LINEPATTERN
#define MBGL_SHADER_SHADER_LINEPATTERN

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class LinepatternShader : public Shader {
public:
    LinepatternShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>                u_matrix         = {"u_matrix",         *this};
    UniformMatrix<4>                u_exmatrix       = {"u_exmatrix",       *this};
    Uniform<std::array<GLfloat, 2>> u_linewidth      = {"u_linewidth",      *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_size_a = {"u_pattern_size_a", *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_tl_a   = {"u_pattern_tl_a",   *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_br_a   = {"u_pattern_br_a",   *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_size_b = {"u_pattern_size_b", *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_tl_b   = {"u_pattern_tl_b",   *this};
    Uniform<std::array<GLfloat, 2>> u_pattern_br_b   = {"u_pattern_br_b",   *this};
    Uniform<GLfloat>                u_ratio          = {"u_ratio",          *this};
    Uniform<GLfloat>                u_point          = {"u_point",          *this};
    Uniform<GLfloat>                u_blur           = {"u_blur",           *this};
    Uniform<GLfloat>                u_fade           = {"u_fade",           *this};
    Uniform<GLfloat>                u_opacity        = {"u_opacity",        *this};
    Uniform<GLfloat>                u_extra          = {"u_extra",          *this};
    UniformMatrix<2>                u_antialiasingmatrix  = {"u_antialiasingmatrix",  *this};

private:
    GLint a_data = -1;
};
}

#endif
