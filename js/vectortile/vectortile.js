function VectorTile(data) {
    var self = this;
    this._buffer = new Protobuf(data._buffer.buf);
    this._buffer.pos = data._buffer.pos;
    this.layers = _.reduce(data.layers, function (obj, v, k) {
        obj[k] = new VectorTileLayer(v, self._buffer);
        return obj;
    }, {});
}
