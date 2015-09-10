#ifndef MBGL_SHADER_SHADER_BOX
#define MBGL_SHADER_SHADER_BOX

#include <mbgl/shader/shader.hpp>
#include <mbgl/shader/uniform.hpp>
#include <mbgl/platform/gl.hpp>

namespace mbgl {

class CollisionBoxShader : public Shader {
public:
    CollisionBoxShader();

    void bind(GLbyte *offset) final;

    UniformMatrix<4>              u_matrix      = {"u_matrix",      *this};
    Uniform<GLfloat>              u_scale       = {"u_scale",       *this};
    Uniform<GLfloat>              u_zoom        = {"u_zoom",        *this};
    Uniform<GLfloat>              u_maxzoom     = {"u_maxzoom",     *this};

protected:
    GLint a_extrude = -1;
    GLint a_data = -1;
};

} // namespace mbgl

#endif // MBGL_SHADER_BOX_SHADER
