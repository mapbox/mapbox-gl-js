
function Geometry(vertices, lineElements, fillElements) {
    this.vertices = vertices;
    this.lineElements = lineElements;
    this.fillElements = fillElements;
    this.bufferProperties = {};
}

// Binds a geometry buffer to a GL context
Geometry.prototype.bind = function(gl) {
    if (!this.vertexBuffer) {
        var vertexBuffer = gl.createBuffer();
        this.bufferProperties.vertexItemSize = 2;
        this.bufferProperties.vertexNumItems = this.vertices.pos / this.bufferProperties.vertexItemSize;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
        this.vertexBuffer = vertexBuffer;
    }

    if (!this.lineElementBuffer) {
        var lineElementBuffer = gl.createBuffer();
        this.bufferProperties.lineElementItemSize = 1;
        this.bufferProperties.lineElementNumItems = this.lineElements.pos / this.bufferProperties.lineElementItemSize;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineElementBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.lineElements, gl.STATIC_DRAW);
        this.lineElementBuffer = lineElementBuffer;
    }


    if (!this.fillElementBuffer) {
        var fillElementBuffer = gl.createBuffer();
        this.bufferProperties.fillElementItemSize = 1;
        this.bufferProperties.fillElementNumItems = this.fillElements.pos / this.bufferProperties.fillElementItemSize;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fillElementBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.fillElements, gl.STATIC_DRAW);
        this.fillElementBuffer = fillElementBuffer;
    }

    return true;
};

Geometry.prototype.unbind = function() {
    this.vertexBuffer = this.lineElementBuffer = this.fillElementBuffer = null;
};
