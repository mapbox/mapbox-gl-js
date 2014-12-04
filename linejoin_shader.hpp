#ifndef MBGL_SHADER_SHADER_LINEJOIN
#define MBGL_SHADER_SHADER_LINEJOIN

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class LinejoinShader : public Shader {
public:
    LinejoinShader();

    void bind(char *offset);

    UniformMatrix<4>              u_matrix    = {"u_matrix",    *this};
    Uniform<std::array<float, 4>> u_color     = {"u_color",     *this};
    Uniform<std::array<float, 2>> u_world     = {"u_world",     *this};
    Uniform<std::array<float, 2>> u_linewidth = {"u_linewidth", *this};
    Uniform<float>                u_size      = {"u_size",      *this};

private:
    int32_t a_pos = -1;
};

}

#endif
