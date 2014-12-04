#ifndef MBGL_SHADER_SHADER_OUTLINE
#define MBGL_SHADER_SHADER_OUTLINE

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class OutlineShader : public Shader {
public:
    OutlineShader();

    void bind(char *offset);

    UniformMatrix<4>              u_matrix = {"u_matrix", *this};
    Uniform<std::array<float, 4>> u_color  = {"u_color",  *this};
    Uniform<std::array<float, 2>> u_world  = {"u_world",  *this};

private:
    int32_t a_pos = -1;
};

}

#endif
