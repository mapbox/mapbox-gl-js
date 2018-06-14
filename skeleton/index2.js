function drawRay(){};

function BufferArray() {
	this.arrayBuffer = new ArrayBuffer(1024000);
	this.int16 = new Int16Array(this.arrayBuffer);
	this.float32 = new Float32Array(this.arrayBuffer);
	this.pos = 0;
	this.byteSize = 32;
}

BufferArray.prototype.add = function(x, y, dx, dy) {
	this.float32[this.pos / 4 + 0] = x;
	this.float32[this.pos / 4 + 1] = y;
	this.float32[this.pos / 4 + 2] = dx;//dx / 100000000;
	//this.float32[this.pos / 4 + 3] = dy;
	this.pos += this.byteSize;
};

const canvas = document.getElementById('mycanvas');
var gl = canvas.getContext('webgl', { antialias: false });

gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
gl.clearColor(0,1,1,1);
gl.clearColor(1,1,1,1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.disable(gl.DEPTH_TEST);
gl.disable(gl.STENCIL_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

const vert = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vert, vertexShader);
gl.compileShader(vert);
console.log(gl.getShaderInfoLog(vert));

const frag = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(frag, fragmentShader);
gl.compileShader(frag);
console.log(gl.getShaderInfoLog(frag));

const program = gl.createProgram();
gl.attachShader(program, vert);
gl.attachShader(program, frag);
gl.linkProgram(program);
gl.useProgram(program);

const output = skeleton(testCases[3], 400, 1800);

const bufferArray = new BufferArray();
for (const poly of output) {
	for (const i of poly.indices) {
		const x = poly.flat[i * 3];
		const y = poly.flat[i * 3 + 1];
		const d = poly.flat[i * 3 + 2];
        console.log(d);
		bufferArray.add(x, y, d || 0);
	}
}

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, bufferArray.arrayBuffer, gl.STATIC_DRAW);

program.u_stroke_width = gl.getUniformLocation(program, "u_stroke_width");
program.u_stroke_colour = gl.getUniformLocation(program, "u_stroke_colour");
program.u_fill_colour = gl.getUniformLocation(program, "u_fill_colour");
program.u_stroke_offset = gl.getUniformLocation(program, "u_stroke_offset");
program.u_inset_width = gl.getUniformLocation(program, "u_inset_width");
program.u_inset_colour = gl.getUniformLocation(program, "u_inset_colour");
program.u_inset_blur = gl.getUniformLocation(program, "u_inset_blur");
program.a_pos = gl.getAttribLocation(program, "a_pos");
gl.enableVertexAttribArray(program.a_pos);
gl.vertexAttribPointer(program.a_pos, 4, gl.FLOAT, false, bufferArray.byteSize, 0);

const lightBlue = [151/255,216/255,244/255,1];
const lightGreen = [167/255, 255/255, 130/255,1];
const darkGreen = [49/255, 165/255, 0, 1];
const middleGreen = [79/255, 224/255, 17/255, 1];
let offset = 0;
render();


const offsetSlider = document.getElementById('offset');
offsetSlider.oninput = function() {
    offset = offsetSlider.value;
    render();
};

function render() {
    gl.uniform1f(program.u_stroke_width, 10);
    gl.uniform4fv(program.u_stroke_colour, darkGreen);
    gl.uniform4fv(program.u_fill_colour, lightGreen);
    gl.uniform1f(program.u_stroke_offset, offset);
    gl.uniform4fv(program.u_inset_colour, middleGreen);
    gl.uniform1f(program.u_inset_width, 20);
    gl.drawArrays(gl.TRIANGLES, 0, bufferArray.pos / bufferArray.byteSize);
};
