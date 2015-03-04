'use strict';

module.exports = ElementGroups;

function ElementGroups(vertexBuffer, elementBuffer, secondElementBuffer) {

    this.vertexBuffer = vertexBuffer;
    this.elementBuffer = elementBuffer;
    this.secondElementBuffer = secondElementBuffer;
    this.groups = [];
}

ElementGroups.prototype.makeRoomFor = function(numVertices) {
    if (!this.current || this.current.vertexLength + numVertices > 65535) {
        this.current = new ElementGroup(this.vertexBuffer.index,
                this.elementBuffer && this.elementBuffer.index,
                this.secondElementBuffer && this.secondElementBuffer.index);
        this.groups.push(this.current);
    }
};

function ElementGroup(vertexStartIndex, elementStartIndex, secondElementStartIndex) {
    // the offset into the vertex buffer of the first vertex in this group
    this.vertexStartIndex = vertexStartIndex;
    this.elementStartIndex = elementStartIndex;
    this.secondElementStartIndex = secondElementStartIndex;
    this.elementLength = 0;
    this.vertexLength = 0;
    this.secondElementLength = 0;
}
