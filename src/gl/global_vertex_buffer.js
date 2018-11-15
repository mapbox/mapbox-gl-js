// @flow

import assert from 'assert';

import type {
    StructArray,
    StructArrayMember
} from '../util/struct_array';

import type Program from '../render/program';
import type Context from '../gl/context';

/**
 * @enum {string} AttributeType
 * @private
 * @readonly
 */
const AttributeType = {
    Int8:   'BYTE',
    Uint8:  'UNSIGNED_BYTE',
    Int16:  'SHORT',
    Uint16: 'UNSIGNED_SHORT',
    Int32:  'INT',
    Uint32: 'UNSIGNED_INT',
    Float32: 'FLOAT'
};

export type BufferSection = {
    start: number,
    length: number,
    index: number,
    array: ?StructArray
};

/**
 * The `VertexBuffer` class turns a `StructArray` into a WebGL buffer. Each member of the StructArray's
 * Struct type is converted to a WebGL atribute.
 * @private
 */
class GlobalVertexBuffer {
    length: number;
    attributes: $ReadOnlyArray<StructArrayMember>;
    itemSize: number;
    context: Context;
    buffer: WebGLBuffer;
    sections: {[number]: BufferSection};
    sectionOrder: Array<number>;
    nextIndex: number;
    allocatedLength: number;

    constructor(context: Context, initialLength: number, itemSize: number, attributes: $ReadOnlyArray<StructArrayMember>) {
        this.length = initialLength;
        this.attributes = attributes;
        this.itemSize = itemSize;
        this.sections = {};
        this.sectionOrder = [];
        this.nextIndex = 0;
        this.allocatedLength = 0;

        this.context = context;
        const gl = context.gl;
        this.buffer = gl.createBuffer();
        context.bindVertexBuffer.set(this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, initialLength * itemSize, gl.DYNAMIC_DRAW);
    }

    bind() {
        this.context.bindVertexBuffer.set(this.buffer);
    }

    addSection(array: StructArray, currentIndex: ?number) {
        const gl = this.context.gl;
        this.bind();
        let section;
        if (currentIndex && this.sections[currentIndex].length === array.length) {
            // Update an existing section
            //console.log(`Updating ${currentIndex} in place`);
            section = this.sections[currentIndex];
        } else if (currentIndex) {
            // Changed length -> need to find a new space for this section
            //console.log(`Removing section ${currentIndex} because of length change`);
            this.removeSection(currentIndex);
        }
        if (!section) {
            // Find a new space
            section = this.getNewSection(array);
        }

        this.testContinuity();

        gl.bufferSubData(gl.ARRAY_BUFFER, section.start * this.itemSize, array.arrayBuffer);
        return section.index;
    }

    getNewSection(array: StructArray) {
        for (const index of this.sectionOrder) {
            const existingSection = this.sections[index];
            if (!existingSection.array && array.length <= existingSection.length) {
                // Found an existing section we can use
                const remainderLength = existingSection.length - array.length;
                existingSection.length = array.length;
                existingSection.array = array;
                if (remainderLength) {
                    // Space left over, mark it as a "free" section
                    const remainderSection = {
                        start: existingSection.start + array.length,
                        length: remainderLength,
                        index: this.nextIndex++
                    };
                    if (remainderSection.start > this.allocatedLength) {
                        console.log(`${remainderSection.start} > ${this.allocatedLength}!`);
                    }
                    this.sections[remainderSection.index] = remainderSection;
                    this.sectionOrder.splice(this.sectionOrder.indexOf(index) + 1, 0, remainderSection.index);
                    //console.log(`${this.key}: Added remainder section index ${remainderSection.index} to ${this.sectionOrder.join(", ")}`);
                    this.joinEmptySections(remainderSection.index);
                }
                return existingSection;
            }
        }
        // Couldn't find an existing section to use, allocate a new one,
        // growing buffer to hold it if necessary
        if (this.length - this.allocatedLength < array.length) {
            this.growBuffer(array.length);
        }
        const newSection = {
            start: this.allocatedLength,
            length: array.length,
            array,
            index: this.nextIndex++
        };
        if (newSection.start > this.allocatedLength) {
            console.log(`${newSection.start} > ${this.allocatedLength}!`);
        }
        this.allocatedLength += array.length;
        this.sections[newSection.index] = newSection;
        this.sectionOrder.push(newSection.index);
        //console.log(`${this.key}: Add ${array.length} to end, allocated length ${this.allocatedLength}, section order: ${this.sectionOrder.join(", ")}`);

        return newSection;
    }

    growBuffer(addedLength: number) {
        // Growing the buffer requires re-copying all the individual arrays
        // It compacts the layout and doubles the reserved size
        let currentLength = 0;
        for (const index in this.sections) {
            currentLength += this.sections[index].length;
        }
        this.length = (currentLength + addedLength) * 2;

        const gl = this.context.gl;
        gl.bufferData(gl.ARRAY_BUFFER, this.length * this.itemSize, gl.DYNAMIC_DRAW);

        this.allocatedLength = 0;
        const newSectionOrder = [];
        for (const index of this.sectionOrder) {
            const section = this.sections[index];
            if (section.array) {
                newSectionOrder.push(index);
                section.start = this.allocatedLength;
                gl.bufferSubData(gl.ARRAY_BUFFER, this.allocatedLength * this.itemSize, section.array.arrayBuffer);
                this.allocatedLength += section.length;
                //console.log(`${this.key}: Copied section ${index} of length ${section.length} (${section.array.length}), new allocated length ${this.allocatedLength}`);
            } else {
                //console.log(`${this.key}: Discarded section ${index}`);
                delete this.sections[index];
            }
        }
        this.sectionOrder = newSectionOrder;
        //console.log(`${this.key}: Compacted section order: ${this.sectionOrder.join(", ")}`);
    }

    joinEmptySections(index: number) {
        // Join adjacent empty sections
        const section = this.sections[index];
        const orderIndex = this.sectionOrder.indexOf(index);
        const prevSectionIndex = orderIndex >= 1 ? this.sectionOrder[orderIndex - 1] : undefined;
        const nextSectionIndex = orderIndex + 1 < this.sectionOrder.length ? this.sectionOrder[orderIndex + 1] : undefined;
        const prevSection = prevSectionIndex ? this.sections[prevSectionIndex] : undefined;
        const nextSection = nextSectionIndex ? this.sections[nextSectionIndex] : undefined;
        if (prevSectionIndex && !prevSection.array && nextSectionIndex && !nextSection.array) {
            section.start -= prevSection.length;
            section.length += prevSection.length + nextSection.length;
            delete this.sections[prevSectionIndex];
            delete this.sections[nextSectionIndex];
            this.sectionOrder.splice(orderIndex - 1, 3, index);
            //console.log(`${this.key}: Deleted prev ${prevSectionIndex} and next ${nextSectionIndex}, leaving ${this.sectionOrder.join(", ")}`);
        } else if (prevSectionIndex && !prevSection.array) {
            section.start -= prevSection.length;
            section.length += prevSection.length;
            delete this.sections[prevSectionIndex];
            this.sectionOrder.splice(orderIndex - 1, 1);
            //console.log(`${this.key}: Deleted prev ${prevSectionIndex}, leaving ${this.sectionOrder.join(", ")}`);
        } else if (nextSectionIndex && !nextSection.array) {
            section.length += nextSection.length;
            delete this.sections[nextSectionIndex];
            this.sectionOrder.splice(orderIndex + 1, 1);
            //console.log(`${this.key}: Deleted next ${nextSectionIndex}, leaving ${this.sectionOrder.join(", ")}`);
        }

        if (!nextSection) {
            // If the section is at the end of the list, merge with the
            // unallocated space.
            if (nextSectionIndex) {
                console.log("Next section index but no section??");
            }
            this.allocatedLength -= section.length;
            //console.log(`${this.key}: Delete ${section.length} from end, allocated length ${this.allocatedLength}`);
            this.sectionOrder.pop();
            delete this.sections[index];
            //console.log(`${this.key}: Deleted ${index} from end of list, leaving ${this.sectionOrder.join(", ")}`);
        }
    }

    removeSection(index: number) {
        // We don't actually remove the data from the uploaded buffer
        // We just mark the space available for future adds
        const section = this.sections[index];
        if (!section) {
            return;
        }
        section.array = undefined;
        //console.log(`Removing section ${index}`);
        this.joinEmptySections(index);
        this.testContinuity();
    }

    buildIndexPositions(segments: SegmentVector) {
        const indexPositions = [];
        const dummyLayoutVertexArray = { length: 0 };
        const dummyIndexArray = { length: 0 };
        for (const index of this.sectionOrder) {
            const section = this.sections[index];
            if (!section.array) {
                const segment = segments.prepareSegment(section.length, dummyLayoutVertexArray, dummyIndexArray);
                dummyLayoutVertexArray.length += section.length;
                segment.vertexLength += section.length;
                continue;
            }
            for (let i = 0; i < section.array.length * 4; i += 16) {
                const segment = segments.prepareSegment(4, dummyLayoutVertexArray, dummyIndexArray);
                const index = segment.vertexLength;
                dummyLayoutVertexArray.length += 4;
                dummyIndexArray.length += 2;

                // TODO: this is a poor-man's low precision, no rotation y-sort
                const y = section.array.uint16[i + 1];

                indexPositions.push({ y, index });

                segment.vertexLength += 4;
                segment.primitiveLength += 2; // Is it OK that we add these later?
            }
        }

        return indexPositions;
    }

    testContinuity() {
        // let start = 0;
        // for (const index of this.sectionOrder) {
        //     const section = this.sections[index];
        //     if (section.start !== start) {
        //         console.log("continuity break!");
        //     }
        //     start += section.length;
        // }
    }

    updateData(array: StructArray) {
        assert(array.length === this.length);
        const gl = this.context.gl;
        this.bind();
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, array.arrayBuffer);
    }

    enableAttributes(gl: WebGLRenderingContext, program: Program<*>) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex: number | void = program.attributes[member.name];
            if (attribIndex !== undefined) {
                gl.enableVertexAttribArray(attribIndex);
            }
        }
    }

    /**
     * Set the attribute pointers in a WebGL context
     * @param gl The WebGL context
     * @param program The active WebGL program
     * @param vertexOffset Index of the starting vertex of the segment
     */
    setVertexAttribPointers(gl: WebGLRenderingContext, program: Program<*>, vertexOffset: ?number) {
        for (let j = 0; j < this.attributes.length; j++) {
            const member = this.attributes[j];
            const attribIndex: number | void = program.attributes[member.name];

            if (attribIndex !== undefined) {
                gl.vertexAttribPointer(
                    attribIndex,
                    member.components,
                    (gl: any)[AttributeType[member.type]],
                    false,
                    this.itemSize,
                    member.offset + (this.itemSize * (vertexOffset || 0))
                );
            }
        }
    }

    /**
     * Destroy the GL buffer bound to the given WebGL context
     */
    destroy() {
        const gl = this.context.gl;
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
            delete this.buffer;
        }
    }
}

export default GlobalVertexBuffer;
