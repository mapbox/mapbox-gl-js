const KM_TO_M = 1000;
const TIME_STEP = 3 * 1000;

const globeVertCode = `
    attribute vec3 a_pos_ecef;
    attribute vec3 a_pos_merc;

    uniform mat4 u_projection;
    uniform mat4 u_globeToMercMatrix;
    uniform float u_globeToMercatorTransition;
    uniform vec2 u_centerInMerc;
    uniform float u_pixelsPerMeterRatio;

    void main() {
        vec4 p = u_projection * u_globeToMercMatrix * vec4(a_pos_ecef, 1.);
        p /= p.w;
        if (u_globeToMercatorTransition > 0.) {
            
            vec4 merc = vec4(a_pos_merc, 1.);
            merc.xy = (merc.xy - u_centerInMerc) * u_pixelsPerMeterRatio + u_centerInMerc;
            merc.z *= u_pixelsPerMeterRatio;

            merc = u_projection * merc;
            merc /= merc.w;
            p = mix(p, merc, u_globeToMercatorTransition);
        }
        gl_PointSize = 30.;
        gl_Position = p;
    }
`;

const mercVertCode = `
    precision highp float;
    attribute vec3 a_pos_merc;
    uniform mat4 u_projection;

    void main() {
        gl_PointSize = 30.;
        gl_Position = u_projection * vec4(a_pos_merc, 1.);
    }
`;

const fragCode = `
    precision highp float;
    uniform vec4 u_color;

    void main() {
        gl_FragColor = vec4(1., 0., 0., 1.);
    }
`;

let time = new Date();

function createShader(gl, src, type) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    const message = gl.getShaderInfoLog(shader);
    if (message.length > 0) {
        console.error(message);
    }
    return shader;
};

function createProgram(gl, vert, frag) {
    var vertShader = this.createShader(gl, vert, gl.VERTEX_SHADER);
    var fragShader = this.createShader(gl, frag, gl.FRAGMENT_SHADER);

    var program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    gl.validateProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        console.error(`Could not compile WebGL program. \n\n${info}`);
    }

    return program;
};

function updateVboAndActivateAttrib(gl, prog, vbo, data, attribName) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
    const attribLoc = gl.getAttribLocation(prog, attribName);
    gl.vertexAttribPointer(attribLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLoc);
}

const satellitesLayer = {
    id: 'satellites',
    type: 'custom',
    onAdd (map, gl) {
        this.map = map;

        this.posEcef = [];
        this.posMerc = [];

        this.posEcefVbo = gl.createBuffer();
        this.posMercVbo = gl.createBuffer();

        this.globeProgram = createProgram(gl, globeVertCode, fragCode);
        this.mercProgram = createProgram(gl, mercVertCode, fragCode);

        fetch('space-track-leo.txt').then(r => r.text()).then(rawData => {
            const tleData = rawData.replace(/\r/g, '')
              .split(/\n(?=[^12])/)
              .filter(d => d)
              .map(tle => tle.split('\n'));
            this.satData = tleData.map(([name, ...tle]) => ({
              satrec: satellite.twoline2satrec(...tle),
              name: name.trim().replace(/^0 /, '')
            }))
            // exclude those that can't be propagated
            .filter(d => !!satellite.propagate(d.satrec, new Date()).position)
            .slice(0, 10);

            this.updateBuffers();
        });
    },

    updateBuffers() {
        time = new Date(+time + TIME_STEP);
        const gmst = satellite.gstime(time);
        this.posEcef = [];
        this.posMerc = [];
        for (let i = 0; i < this.satData.length; ++i) {
            const satrec = this.satData[i].satrec;
            const eci = satellite.propagate(satrec, time);
            if (eci.position) {
                const geodetic = satellite.eciToGeodetic(eci.position, gmst);

                const lngLat = [satellite.degreesLong(geodetic.longitude), satellite.degreesLat(geodetic.latitude)];
                const altitude = geodetic.height * KM_TO_M;

                const merc = mapboxgl.MercatorCoordinate.fromLngLat(lngLat, altitude);
                const ecef = mapboxgl.LngLat.convert(lngLat).toEcef(altitude);

                this.posEcef.push(...ecef);
                this.posMerc.push(...[merc.x, merc.y, merc.z]);
            }
        }
    },

    render (gl, projectionMatrix, projection, globeToMercMatrix, transition, centerInMercator, pixelsPerMeterRatio) {
        if (this.satData) {
            this.updateBuffers();

            const primitiveCount = this.posEcef.length / 3;
            gl.disable(gl.DEPTH_TEST);
            if (projection && projection.name === 'globe') { // globe projection and globe to mercator transition
                gl.useProgram(this.globeProgram);
    
                updateVboAndActivateAttrib(gl, this.globeProgram, this.posEcefVbo, this.posEcef, "a_pos_ecef");
                updateVboAndActivateAttrib(gl, this.globeProgram, this.posMercVbo, this.posMerc, "a_pos_merc");
                gl.uniformMatrix4fv(gl.getUniformLocation(this.globeProgram, "u_projection"), false, projectionMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.globeProgram, "u_globeToMercMatrix"), false, globeToMercMatrix);
                gl.uniform1f(gl.getUniformLocation(this.globeProgram, "u_globeToMercatorTransition"), transition);
                gl.uniform2f(gl.getUniformLocation(this.globeProgram, "u_centerInMerc"), centerInMercator[0], centerInMercator[1]);
                gl.uniform1f(gl.getUniformLocation(this.globeProgram, "u_pixelsPerMeterRatio"), pixelsPerMeterRatio);

                gl.drawArrays(gl.POINTS, 0, primitiveCount);
            } else { // mercator projection
                gl.useProgram(this.mercProgram);
                updateVboAndActivateAttrib(gl, this.mercProgram, this.posMercVbo, this.posMerc, "a_pos_merc");
                gl.uniformMatrix4fv(gl.getUniformLocation(this.mercProgram, "u_projection"), false, projectionMatrix);
                gl.drawArrays(gl.POINTS, 0, primitiveCount);
            }
        }
    }
};