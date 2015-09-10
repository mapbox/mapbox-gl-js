#ifndef MBGL_RENDERER_SHADER
#define MBGL_RENDERER_SHADER

#include <mbgl/platform/gl.hpp>
#include <mbgl/util/noncopyable.hpp>

#include <cstdint>
#include <array>
#include <string>

namespace mbgl {

class Shader : private util::noncopyable {
public:
    Shader(const GLchar *name, const GLchar *vertex, const GLchar *fragment);

    ~Shader();
    const GLchar *name;
    GLuint program;

    inline GLuint getID() const {
        return program;
    }

    virtual void bind(GLbyte *offset) = 0;

protected:
    GLint a_pos = -1;

private:
    bool compileShader(GLuint *shader, GLenum type, const GLchar *source[]);

    GLuint vertShader = 0;
    GLuint fragShader = 0;
};

}

#endif
