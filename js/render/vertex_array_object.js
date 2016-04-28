'use strict';

var assert = require('assert');

module.exports = VertexArrayObject;

function VertexArrayObject() {
    this.boundProgram = null;
    this.boundVertexBuffer = null;
    this.boundVertexBuffer2 = null;
    this.boundElementBuffer = null;
    this.vao = null;
}

var reported = false;

VertexArrayObject.prototype.bind = function(gl, program, vertexBuffer, elementBuffer, vertexBuffer2) {

    var ext = gl.extVertexArrayObject;
    if (ext === undefined) {
        ext = gl.extVertexArrayObject = gl.getExtension("OES_vertex_array_object");
    }

    if (ext) {
        if (!this.vao) this.vao = ext.createVertexArrayOES();
        ext.bindVertexArrayOES(this.vao);
    } else if (!reported) {
        console.warn('Not using VertexArrayObject extension.');
        reported = true;
    }

    if (!this.boundProgram) {

        var numPrevAttributes = ext ? 0 : (gl.currentNumAttributes || 0);
        var numNextAttributes = program.numAttributes;
        var i;

        // Enable all attributes for the new program.
        for (i = numPrevAttributes; i < numNextAttributes; i++) {
            gl.enableVertexAttribArray(i);
        }

        if (!ext) {
            // Disable all attributes from the previous program that aren't used in
            // the new program. Note: attribute indices are *not* program specific!
            // WebGL breaks if you disable attribute 0. http://stackoverflow.com/questions/20305231
            assert(i > 0);
            for (i = numNextAttributes; i < numPrevAttributes; i++) {
                gl.disableVertexAttribArray(i);
            }
            gl.currentNumAttributes = numNextAttributes;
        }

        vertexBuffer.bind(gl);
        vertexBuffer.setVertexAttribPointers(gl, program);
        if (vertexBuffer2) {
            vertexBuffer2.bind(gl);
            vertexBuffer2.setVertexAttribPointers(gl, program);
        }
        if (elementBuffer) {
            elementBuffer.bind(gl);
        }

        if (ext) {
            // store the arguments so that we can verify them when the vao is bound again
            this.boundProgram = program;
            this.boundVertexBuffer = vertexBuffer;
            this.boundVertexBuffer2 = vertexBuffer2;
            this.boundElementBuffer = elementBuffer;
        }

    } else {
        // verify that bind was called with the same arguments
        assert(this.boundProgram === program, 'trying to bind a VAO to a different shader');
        assert(this.boundVertexBuffer === vertexBuffer, 'trying to bind a VAO to a different vertex buffer');
        assert(this.boundVertexBuffer2 === vertexBuffer2, 'trying to bind a VAO to a different vertex buffer');
        assert(this.boundElementBuffer === elementBuffer, 'trying to bind a VAO to a different element buffer');
    }
};

VertexArrayObject.prototype.unbind = function(gl) {
    var ext = gl.extVertexArrayObject;
    if (ext) {
        ext.bindVertexArrayOES(null);
    }
};

VertexArrayObject.prototype.destroy = function(gl) {
    var ext = gl.extVertexArrayObject;
    if (ext && this.vao) {
        ext.deleteVertexArrayOES(this.vao);
        this.vao = null;
    }
};
