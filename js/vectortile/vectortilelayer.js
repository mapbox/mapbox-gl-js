/*
 * Construct a layer based on an object of data and a buffer
 *
 * @param {object} data
 * @param {object} buffer
 * @returns {VectorTileLayer}
 */
function VectorTileLayer(data, buffer) {
    for (var key in data) {
        this[key] = data[key];
    }
    this._buffer = buffer;
}

/*
 * Return feature `i` from this layer as a `VectorTileFeature`
 *
 * @param {number} i
 * @returns {VectorTileFeature}
 */
VectorTileLayer.prototype.feature = function(i) {
    if (i < 0 || i >= this._features.length) {
        throw new Error('feature index out of bounds');
    }

    this._buffer.pos = this._features[i];
    var end = this._buffer.readVarint() + this._buffer.pos;
    return new VectorTileFeature(this._buffer, end, this.extent, this._keys, this._values);
};
