function PointGeometry() {
    this.vertex = new VertexBuffer();
}


PointGeometry.prototype.addPoint = function(line) {
    var point = line[0];

    this.vertex.add(point.x, point.y, 0, 0, 0, 0);
    this.vertex.add(point.x, point.y, 0, 0, 0, 0);
    this.vertex.add(point.x, point.y, 1, 0, 0, 0);
    this.vertex.add(point.x, point.y, 0, 1, 0, 0);
    this.vertex.add(point.x, point.y, 1, 1, 0, 0);
    this.vertex.add(point.x, point.y, 1, 1, 0, 0);
}
