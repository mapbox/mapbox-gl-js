'use strict';

var assert = require('assert');
var util = require('../util/util');

module.exports = VertexArrayObject;

function VertexArrayObject() {
    this.boundProgram = null;
    this.boundVertexBuffer = null;
    this.boundVertexBuffer2 = null;
    this.boundElementBuffer = null;
    this.vao = null;
}

VertexArrayObject.prototype.bind = function(gl, program, vertexBuffer, elementBuffer, vertexBuffer2) {

    var ext = gl.extVertexArrayObject;
    if (ext === undefined) {
        ext = gl.extVertexArrayObject = gl.getExtension("OES_vertex_array_object");
    }

    if (ext) {
        if (!this.vao) this.vao = ext.createVertexArrayOES();
        ext.bindVertexArrayOES(this.vao);
    } else {
        util.warnOnce('Not using VertexArrayObject extension.');
    }

    var isFreshBindRequired = !(
        this.boundProgram &&
        this.boundProgram === program &&
        this.boundVertexBuffer === vertexBuffer &&
        this.boundVertexBuffer2 === vertexBuffer2 &&
        this.boundElementBuffer === elementBuffer
    );

    if (isFreshBindRequired) {
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
