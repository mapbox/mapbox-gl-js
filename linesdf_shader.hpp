#ifndef MBGL_SHADER_SHADER_LINESDF
#define MBGL_SHADER_SHADER_LINESDF

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class LineSDFShader : public Shader {
public:
    LineSDFShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>                 u_matrix    = {"u_matrix",    *this};
    UniformMatrix<4>                 u_exmatrix  = {"u_exmatrix",  *this};
    Uniform<std::array<GLfloat, 4>>  u_color     = {"u_color",     *this};
    Uniform<std::array<GLfloat, 2>>  u_linewidth = {"u_linewidth", *this};
    Uniform<GLfloat>                 u_ratio     = {"u_ratio",     *this};
    Uniform<GLfloat>                 u_blur      = {"u_blur",      *this};
    Uniform<std::array<GLfloat, 2>>  u_patternscale_a = { "u_patternscale_a", *this};
    Uniform<GLfloat>                 u_tex_y_a   = {"u_tex_y_a",   *this};
    Uniform<std::array<GLfloat, 2>>  u_patternscale_b = { "u_patternscale_b", *this};
    Uniform<GLfloat>                 u_tex_y_b   = {"u_tex_y_b",   *this};
    Uniform<GLint>                   u_image     = {"u_image",     *this};
    Uniform<GLfloat>                 u_sdfgamma  = {"u_sdfgamma",  *this};
    Uniform<GLfloat>                 u_mix       = {"u_mix",       *this};
    Uniform<GLfloat>                 u_extra     = {"u_extra",     *this};
    UniformMatrix<2>                 u_antialiasingmatrix = {"u_antialiasingmatrix", *this};

private:
    GLint a_data = -1;
};


}

#endif
