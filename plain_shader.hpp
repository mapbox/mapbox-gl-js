#ifndef MBGL_SHADER_SHADER_PLAIN
#define MBGL_SHADER_SHADER_PLAIN

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>

namespace mbgl {

class PlainShader : public Shader {
public:
    PlainShader();

    void bind(char *offset);

    UniformMatrix<4>              u_matrix   = {"u_matrix", *this};
    Uniform<std::array<float, 4>> u_color    = {"u_color",  *this};

private:
    int32_t a_pos = -1;
};

}

#endif
