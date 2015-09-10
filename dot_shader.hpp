#ifndef MBGL_SHADER_SHADER_DOT
#define MBGL_SHADER_SHADER_DOT

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class DotShader : public Shader {
public:
    DotShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>              u_matrix = {"u_matrix", *this};
    Uniform<std::array<float, 4>> u_color  = {"u_color",  *this};
    Uniform<float>                u_size   = {"u_size",   *this};
    Uniform<float>                u_blur   = {"u_blur",   *this};
};

}

#endif
