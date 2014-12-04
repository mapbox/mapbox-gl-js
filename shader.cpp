#include <mbgl/shader/shader.hpp>
#include <mbgl/platform/gl.hpp>
#include <mbgl/util/stopwatch.hpp>
#include <mbgl/platform/log.hpp>

#include <cstring>
#include <cstdlib>

using namespace mbgl;

Shader::Shader(const char *name_, const GLchar *vertSource, const GLchar *fragSource)
    : name(name_),
      valid(false),
      program(0) {
    util::stopwatch stopwatch("shader compilation", Event::Shader);

    GLuint vertShader;
    if (!compileShader(&vertShader, GL_VERTEX_SHADER, vertSource)) {
        Log::Error(Event::Shader, "Vertex shader failed to compile: %s", vertSource);
        return;
    }

    GLuint fragShader;
    if (!compileShader(&fragShader, GL_FRAGMENT_SHADER, fragSource)) {
        Log::Error(Event::Shader, "Fragment shader failed to compile: %s", fragSource);
        return;
    }

    program = glCreateProgram();

    // Attach shaders
    glAttachShader(program, vertShader);
    glAttachShader(program, fragShader);


    {
        // Link program
        GLint status;
        glLinkProgram(program);

        glGetProgramiv(program, GL_LINK_STATUS, &status);
        if (status == 0) {
            GLint logLength;
            glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
            if (logLength > 0) {
                GLchar *log = (GLchar *)malloc(logLength);
                glGetProgramInfoLog(program, logLength, &logLength, log);
                Log::Error(Event::Shader, "Program failed to link: %s", log);
                free(log);
            }

            glDeleteShader(vertShader);
            vertShader = 0;
            glDeleteShader(fragShader);
            fragShader = 0;
            glDeleteProgram(program);
            program = 0;
            return;
        }
    }

    {
        // Validate program
        GLint status;
        glValidateProgram(program);

        glGetProgramiv(program, GL_VALIDATE_STATUS, &status);
        if (status == 0) {
            GLint logLength;
            glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLength);
            if (logLength > 0) {
                GLchar *log = (GLchar *)malloc(logLength);
                glGetProgramInfoLog(program, logLength, &logLength, log);
                Log::Error(Event::Shader, "Program failed to validate: %s", log);
                free(log);
            }

            glDeleteShader(vertShader);
            vertShader = 0;
            glDeleteShader(fragShader);
            fragShader = 0;
            glDeleteProgram(program);
            program = 0;
        }

    }

    // Remove the compiled shaders; they are now part of the program.
    glDetachShader(program, vertShader);
    glDeleteShader(vertShader);
    glDetachShader(program, fragShader);
    glDeleteShader(fragShader);

    valid = true;
}


bool Shader::compileShader(GLuint *shader, GLenum type, const GLchar *source) {
    GLint status;

    *shader = glCreateShader(type);
    const GLchar *strings[] = { source };
    const GLint lengths[] = { (GLint)strlen(source) };
    glShaderSource(*shader, 1, strings, lengths);

    glCompileShader(*shader);

    glGetShaderiv(*shader, GL_COMPILE_STATUS, &status);
    if (status == 0) {
        GLint logLength;
        glGetShaderiv(*shader, GL_INFO_LOG_LENGTH, &logLength);
        if (logLength > 0) {
            GLchar *log = (GLchar *)malloc(logLength);
            glGetShaderInfoLog(*shader, logLength, &logLength, log);
            Log::Error(Event::Shader, "Shader failed to compile: %s", log);
            free(log);
        }

        glDeleteShader(*shader);
        *shader = 0;
        return false;
    }

    return true;
}

Shader::~Shader() {
    if (program) {
        glDeleteProgram(program);
        program = 0;
        valid = false;
    }
}
