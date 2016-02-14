#ifndef MBGL_RENDERER_SHADER
#define MBGL_RENDERER_SHADER

#include <mbgl/gl/gl.hpp>
#include <mbgl/gl/gl_object_store.hpp>
#include <mbgl/util/noncopyable.hpp>

namespace mbgl {

class Shader : private util::noncopyable {
public:
    Shader(const GLchar *name, const GLchar *vertex, const GLchar *fragment);

    ~Shader();
    const GLchar *name;

    inline const GLuint& getID() const {
        return program.getID();
    }

    virtual void bind(GLbyte *offset) = 0;

protected:
    GLint a_pos = -1;

private:
    bool compileShader(GLuint *shader, GLenum type, const GLchar *source[]);

    gl::ProgramHolder program;
    GLuint vertShader = 0;
    GLuint fragShader = 0;
};

} // namespace mbgl

#endif
