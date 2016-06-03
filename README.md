# Mapbox GL Shaders

Shared GL shaders between [Mapbox GL JS](https://github.com/mapbox/mapbox-gl-js)
and [Mapbox GL Native](https://github.com/mapbox/mapbox-gl-native).

## Uniform pragmas

We use custom pragmas in shader code to define and initialize uniform variables.
These conveniently abstracts away the _Data-Driven Styling_-specific code. These
commands are parsed and generates code readable by the shader compiler.

Syntax for uniform pragmas is:

```
#pragma mapbox: (define|initialize) (lowp|mediump|highp) {type} {name}
```

Where:
- {type} is the variable type e.g. `float` or `vec2`.
- {name} is the variable name used inside `main()`.

Example usage:

```
#pragma mapbox: define lowp vec4 color

void main(void) {
    #pragma mapbox: initialize lowp vec4 color
    ...
    gl_FragColor = color;
}
```
