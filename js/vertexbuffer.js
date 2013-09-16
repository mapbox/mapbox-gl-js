/*
 * Create a simpler wrapper around a single arraybuffer with two views,
 * `coords` and `extrude`.
 */
function VertexBuffer(vertexBuffer) {

    if (!vertexBuffer) {
        this.array = new ArrayBuffer(32768);
        this.length = 32768;
        this.pos = 0; // byte index already written
        this.itemSize = 8; // bytes per vertex

        this.coords = new Int16Array(this.array);
        this.extrude = new Int8Array(this.array);

    } else {
        for (var prop in vertexBuffer) {
            this[prop] = vertexBuffer[prop];
        }
    }
}

// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
VertexBuffer.extrudeScale = 63;

VertexBuffer.prototype = {
    get index() {
        return this.pos / this.itemSize;
    }
};

VertexBuffer.prototype.bind = function(gl) {
    if (!this.buffer) {
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.array.slice(0, this.pos), gl.STATIC_DRAW);
    } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    }
};

// increase the buffer size by at least /required/ bytes.
VertexBuffer.prototype.resize = function(required) {
    if (this.length < this.pos + required) {
        while (this.length < this.pos + required) this.length += 32768;
        this.array = new ArrayBuffer(this.length);
        var coords = new Int16Array(this.array);
        coords.set(this.coords);
        this.coords = coords;
        this.extrude = new Int8Array(this.array);
    }
};

/*
 * Add a vertex to this buffer
 *
 * @param {number} x vertex position
 * @param {number} y vertex position
 * @param {number} ex extrude normal
 * @param {number} ey extrude normal
 * @param {number} tx texture normal
 * @param {number} ty texture normal
 */
VertexBuffer.prototype.add = function(x, y, ex, ey, tx, ty) {
    this.resize(this.itemSize);
    this.coords[this.pos / 2 + 0] = (Math.floor(x) * 2) | tx;
    this.coords[this.pos / 2 + 1] = (Math.floor(y) * 2) | ty;
    this.extrude[this.pos + 4] = Math.round(VertexBuffer.extrudeScale * ex);
    this.extrude[this.pos + 5] = Math.round(VertexBuffer.extrudeScale * ey);
    this.pos += this.itemSize;
};

/*
 * Add a degenerate triangle to the buffer
 *
 * > So we need a way to get from the end of one triangle strip
 * to the beginning of the next strip without actually filling triangles
 * on the way. We can do this with "degenerate" triangles: We simply
 * repeat the last coordinate of the first triangle strip and the first
 * coordinate of the next triangle strip.
 */
VertexBuffer.prototype.addDegenerate = function() {
    this.add(16383, 16383, 0, 0, 1, 1);
};
