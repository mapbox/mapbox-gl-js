/*
 * Given arrays of vertices, lineElements, and fillElements,
 * return a function that can bind those geometries to a GL context
 */
function Geometry(vertices, lineElements, fillElements) {
    this.vertices = vertices;
    this.lineElements = lineElements;
    this.fillElements = fillElements;
}

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
