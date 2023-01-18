function getColor(tileId) {
    const m = Math.pow(2, tileId.z);
    const s = tileId.z + tileId.x * m + tileId.y * m;
    const r = (Math.sin(s + 5) * 1924957) % 1;
    const g = (Math.sin(s + 7) * 3874133) % 1;
    const b = (Math.sin(s + 3) * 7662617) % 1;
    return [r, g, b];
};

var coloredEarthLayer = {
    id: 'coloredEarth',
    type: 'custom',

    onAdd: (map, gl) => {
        const vertexSource = `
        attribute vec2 a_pos;
        void main() {
            gl_Position = vec4(a_pos, 1.0, 1.0);
        }`;

        const fragmentSource = `
        precision highp float;
        uniform vec3 u_color;
        void main() {
            gl_FragColor = vec4(u_color, 0.5);
        }`;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        this.program.aPos = gl.getAttribLocation(this.program, "a_pos");
        this.program.uColor = gl.getUniformLocation(this.program, "u_color");

        const verts = new Float32Array([1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1, 1]);
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    },

    shouldRerenderTiles: () => {
        // return true only when frame content has changed otherwise, all the terrain
        // render cache would be invalidated and redrawn causing huge drop in performance.
        return true;
    },

    renderToTile: (gl, tileId) => {
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.enableVertexAttribArray(this.program.aPos);
        gl.vertexAttribPointer(this.program.aPos, 2, gl.FLOAT, false, 0, 0);
        const color = getColor(tileId);
        gl.uniform3f(this.program.uColor, color[0], color[1], color[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    render: (gl, matrix) => {
    }
};