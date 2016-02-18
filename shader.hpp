#ifndef MBGL_RENDERER_SHADER
#define MBGL_RENDERER_SHADER

#include <mbgl/gl/gl.hpp>
#include <mbgl/gl/gl_object_store.hpp>
#include <mbgl/util/noncopyable.hpp>

namespace mbgl {

class Shader : private util::noncopyable {
public:
    Shader(const GLchar *name, const GLchar *vertex, const GLchar *fragment, gl::GLObjectStore&);

    ~Shader();
    const GLchar *name;

    GLuint getID() const {
        return program.getID();
    }

    virtual void bind(GLbyte *offset) = 0;

protected:
    GLint a_pos = -1;

private:
    bool compileShader(gl::ShaderHolder&, const GLchar *source[]);

    gl::ProgramHolder program;
    gl::ShaderHolder vertexShader = { GL_VERTEX_SHADER };
    gl::ShaderHolder fragmentShader = { GL_FRAGMENT_SHADER };
};

} // namespace mbgl

#endif
