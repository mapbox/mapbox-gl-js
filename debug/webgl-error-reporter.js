(function(WebGLRenderingContext) {
    // This function implements an error reporter for WebGL shaders. It works by wrapping
    // the WebGL calls, caching the shader source, and automatically checking for an error
    // when compileShader is invoked.
    //
    // To use, simply include this script in a debug page. For example, add to any of the
    // HTML files in the debug directory,
    //
    //   <script src="./webgl-error-reporter.js"></script>
    //
    // No other setup is required.
    //
    // This script is not known to have any side effects which should affect the behavior
    // of MapboxGL, though since these errors should not occur in published source, this
    // reporting is not included in the source itself.

    const shaderCache = new WeakMap();

    function parseError(error) {
        const parts = error.match(/.*: ([\d]+):([\d]+):\s+(.*)/);
        return {errorLine: parseInt(parts[2]), errorMessage: `ERROR: ${parts[3].trim()}`};
    }

    function wrapWebGLRenderingContext(WebGLRenderingContext) {
        const {
            shaderSource,
            getShaderParameter,
            compileShader,
            COMPILE_STATUS,
            getShaderInfoLog
        } = WebGLRenderingContext.prototype;

        // Cache the source so that we have it available for logging in case of error
        WebGLRenderingContext.prototype.shaderSource = function (...args) {
            const shader = args[0];
            const source = args[1];
            shaderCache.set(shader, source);
            // .call() returns an illegal invocation error (maybe arity?), so apply.
            return shaderSource.apply(this, args);
        };

        WebGLRenderingContext.prototype.compileShader = function (shader) {
            const returnValue = compileShader.call(this, shader);

            if (!getShaderParameter.call(this, shader, COMPILE_STATUS)) {
                const source = shaderCache.get(shader);
                const error = getShaderInfoLog.apply(this, [shader]);
                const {errorLine, errorMessage} = parseError(error);

                const lines = source.split('\n')
                    .map((line, num) => `${(num + 1).toString().padStart(5, ' ')} ${line}`);

                const localLines = lines.slice(Math.max(0, errorLine - 2), errorLine + 1);
                lines.splice(errorLine, 0, `^^^^^\n     ${errorMessage}\n`);

                // I wish the formatting were cleaner, but in order to minimize how invasive this is
                // in changing the behavior, gl-js will still throw an error *after* this function
                // returns, thus we really only want to output the annotated source in a collapsed
                // group with the important info up front
                console.error(error.trim());
                console.groupCollapsed(`${localLines.join('\n')}`);
                console.info(lines.join('\n'));
                console.groupEnd();
            }

            return returnValue;
        }
    }

    wrapWebGLRenderingContext(WebGLRenderingContext);
}(window.WebGLRenderingContext));
