'use strict';

module.exports = ElementGroups;

function ElementGroups(vertexBuffer, elementBuffer, groups) {

    this.vertexBuffer = vertexBuffer;
    this.elementBuffer = elementBuffer;

    if (groups) {
        this.groups = groups;
    } else {
        this.groups = [];
    }
}

ElementGroups.prototype.makeRoomFor = function(numVertices) {
    if (!this.current || this.current.vertexLength + numVertices > 65535) {
        this.current = new ElementGroup(this.vertexBuffer.index, this.elementBuffer && this.elementBuffer.index);
        this.groups.push(this.current);
    }
};

function ElementGroup(vertexStartIndex, elementStartIndex)  {
    // the offset into the vertex buffer of the first vertex in this group
    this.vertexStartIndex = vertexStartIndex;
    this.elementStartIndex = elementStartIndex;
    this.elementLength = 0;
    this.vertexLength = 0;
}
