function PointGeometry() {
    this.vertex = new VertexBuffer();
}

PointGeometry.prototype.addPoint = function(x, y) {

    this.vertex.add(x, y, 0, 0, 0, 0);
    this.vertex.add(x, y, 1, 0, 0, 0);
    this.vertex.add(x, y, 0, 1, 0, 0);
    this.vertex.add(x, y, 1, 1, 0, 0);
    this.vertex.addDegenerate();
}
