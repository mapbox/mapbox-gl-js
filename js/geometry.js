
function Geometry() {
    this.vertices = new Int16Array(10000);
    this.vertices.pos = 0;
    this.vertices.idx = 0;

    this.lineElements = new Uint16Array(10000);
    this.lineElements.pos = 0;

    this.fillElements = new Uint16Array(10000);
    this.fillElements.pos = 0;

    // Add the culled mvp vertex
    this.vertices[this.vertices.pos++] = 32767;
    this.vertices[this.vertices.pos++] = 32767;
    this.vertices.idx++;
}

Geometry.prototype.lineOffset = function() {
    return this.lineElements.pos;
};

Geometry.prototype.fillOffset = function() {
    return this.fillElements.pos;
};

// Binds a geometry buffer to a GL context
Geometry.prototype.bind = function(gl) {
    if (!this.vertexBuffer) {
        var vertexBuffer = gl.createBuffer();
        vertexBuffer.itemSize = 2;
        vertexBuffer.numItems = this.vertices.pos / vertexBuffer.itemSize;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
        this.vertexBuffer = vertexBuffer;
    }

    if (!this.lineElementBuffer) {
        var lineElementBuffer = gl.createBuffer();
        lineElementBuffer.itemSize = 1;
        lineElementBuffer.numItems = this.lineElements.pos / lineElementBuffer.itemSize;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineElementBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.lineElements, gl.STATIC_DRAW);
        this.lineElementBuffer = lineElementBuffer;
    }


    if (!this.fillElementBuffer) {
        var fillElementBuffer = gl.createBuffer();
        fillElementBuffer.itemSize = 1;
        fillElementBuffer.numItems = this.fillElements.pos / fillElementBuffer.itemSize;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fillElementBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.fillElements, gl.STATIC_DRAW);
        this.fillElementBuffer = fillElementBuffer;
    }

    return true;
};
