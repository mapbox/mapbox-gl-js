#ifndef MBGL_SHADER_SHADER_LINE
#define MBGL_SHADER_SHADER_LINE

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class LineShader : public Shader {
public:
    LineShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>                 u_matrix    = {"u_matrix",    *this};
    UniformMatrix<4>                 u_exmatrix  = {"u_exmatrix",  *this};
    Uniform<std::array<GLfloat, 4>>  u_color     = {"u_color",     *this};
    Uniform<std::array<GLfloat, 2>>  u_linewidth = {"u_linewidth", *this};
    Uniform<GLfloat>                 u_ratio     = {"u_ratio",     *this};
    Uniform<GLfloat>                 u_blur      = {"u_blur",      *this};
    Uniform<GLfloat>                 u_extra     = {"u_extra",     *this};
    UniformMatrix<2>                 u_antialiasingmatrix  = {"u_antialiasingmatrix",  *this};

private:
    GLint a_data = -1;
};


}

#endif
