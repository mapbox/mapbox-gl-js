
function Geometry() {
    this.vertices = new Int16Array(250000);
    this.vertices.pos = 0;
}

Geometry.prototype.addLines = function(layer) {
    // console.time('Geometry#addLines');
    for (var i = 0; i < layer.length; i++) {
        var feature = layer.feature(i);
        feature.drawNative(this.vertices);
    }

    // array[array.pos++] = 1000;
    // array[array.pos++] = 1000;
    // array[array.pos++] = 0; // invisible
    // array[array.pos++] = 1000;
    // array[array.pos++] = 1000;
    // array[array.pos++] = 0; // invisible
    // console.warn(this.vertices.pos);
    // console.timeEnd('Geometry#addLines');
};

//     if (!vertices) return;

//     if (vertices.byteOffset % 2) {
//         throw new Error('Geometry begins at odd byte offset');
//     }

//     var start = Date.now();
//     vertices = new Uint16Array(vertices.buffer, vertices.byteOffset, vertices.length / 2);
//     types = new Uint8Array(types.buffer, types.byteOffset, types.length);

//     // Calculate total length of the destination buffer after transformation
//     // First, find out how many distinct features we have
//     var features = 0;
//     for (var i = 0; i < types.length; i++) {
//         if (types[i] & Geometry.PATH) {
//             features++;
//         }
//     }

//     var length = vertices.length * 3 + features * 2 * 3;
//     var buffer = new Uint16Array(length);

//     var typeIdx = 0, vertIdx = 0, buffIdx = 0;
//     while (typeIdx < types.length) {
//         // At the beginning and end of a feature, duplicate the coordinate
//         if (types[typeIdx] & Geometry.PATH) {
//             buffer[buffIdx++] = vertices[vertIdx];
//             buffer[buffIdx++] = vertices[vertIdx+1];
//             buffer[buffIdx++] = 0; // invisible
//         }

//         buffer[buffIdx++] = vertices[vertIdx];
//         buffer[buffIdx++] = vertices[vertIdx+1];
//         buffer[buffIdx++] = 1; // visible, left
//         // buffer[buffIdx++] = vertices[vertIdx];
//         // buffer[buffIdx++] = vertices[vertIdx+1];
//         // buffer[buffIdx++] = 2; // visible, right

//         typeIdx++;

//         // At the end of a feature, add the coordinate again.
//         if (typeIdx >= types.length || types[typeIdx] & Geometry.PATH) {
//             // buffer[buffIdx++] = vertices[vertIdx];
//             // buffer[buffIdx++] = vertices[vertIdx+1];
//             // buffer[buffIdx++] = 0; // invisible
//         }

//         vertIdx += 2;
//     }

//     // this.vertices = vertices;
//     this.vertices = buffer;
//     this.types = types;

//     // console.warn('geometry', Date.now() - start);
// }

// Binds a geometry buffer to a GL context
Geometry.prototype.bind = function(gl) {
    if (!this.buffer) {
        // console.time('Geometry#bind');
        var buffer = gl.createBuffer();
        buffer.itemSize = 3;
        buffer.numItems = this.vertices.pos / buffer.itemSize;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
        this.buffer = buffer;
        // console.timeEnd('Geometry#bind');
    }

    return this.buffer;
};
