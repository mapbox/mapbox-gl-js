/*
 * Allocate a container for vertices, line elements, and fill elements
 * with `Uint16Array`s for each
 */
function GeometryParser() {
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

GeometryParser.prototype.lineOffset = function() {
    return this.lineElements.pos;
};

GeometryParser.prototype.fillOffset = function() {
    return this.fillElements.pos;
};
