// @flow

import StyleLayer from '../style_layer';
import type Framebuffer from '../../gl/framebuffer';
import type Map from '../../ui/map';
import assert from 'assert';


type CustomRenderMethod = (gl: WebGLRenderingContext, matrix: Array<number>) => void;

/**
 * Interface for custom style layers. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Custom layers allow a user to render directly into the map's GL context using the map's camera.
 * These layers can be added between any regular layers using {@link Map#addLayer}.
 *
 * Custom layers must have a unique `id` and must have the `type` of `"custom"`.
 * They should implement at least one of `render` and `render3D` and should implement
 * `onAdd` and `onRemove`. They can trigger rendering using {@link Map#triggerRepaint}
 * and they should appropriately handle {@link Map.event:webglcontextlost} and
 * {@link Map.event:webglcontextrestored}.
 *
 * @interface CustomLayerInterface
 * @property {string} id A unique layer id.
 * @property {string} type The layer's type. Must be `"custom"`.
 * @example
 * // Custom layer implemented as ES6 class
 * class NullIslandLayer {
 *     constructor() {
 *         this.id = 'null-island';
 *         this.type = 'custom';
 *     }
 * 
 *     onAdd(map, gl) {
 *         const vertexSource = `
 *         uniform mat4 u_matrix;
 *         void main() {
 *             gl_Position = u_matrix * vec4(0.5, 0.5, 0.0, 1.0);
 *             gl_PointSize = 20.0;
 *         }`;
 * 
 *         const fragmentSource = `
 *         void main() {
 *             gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
 *         }`;
 * 
 *         const vertexShader = gl.createShader(gl.VERTEX_SHADER);
 *         gl.shaderSource(vertexShader, vertexSource);
 *         gl.compileShader(vertexShader);
 *         const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
 *         gl.shaderSource(fragmentShader, fragmentSource);
 *         gl.compileShader(fragmentShader);
 * 
 *         this.program = gl.createProgram();
 *         gl.attachShader(this.program, vertexShader);
 *         gl.attachShader(this.program, fragmentShader);
 *         gl.linkProgram(this.program);
 *     }
 * 
 *     render(gl, matrix) {
 *         gl.useProgram(this.program);
 *         gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_matrix"), false, matrix);
 *         gl.drawArrays(gl.POINTS, 0, 1);
 *     }
 * }
 *
 * map.on('load', function() {
 *     map.addLayer(new NullIslandLayer());
 * });
 */

/**
 * Called when the layer has been added to the Map with {@link Map#addLayer}. This
 * gives the layer a chance to initialize gl resources and register event listeners.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name onAdd
 * @param {Map} map The Map this custom layer was just added to.
 * @param {WebGLRenderingContext} gl The gl context for the map.
 */

/**
 * Called when the layer has been removed from the Map with {@link Map#removeLayer}. This
 * gives the layer a chance to clean up gl resources and event listeners.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name onRemove
 * @param {Map} map The Map this custom layer was just added to.
 */

/**
 * Called during a render frame allowing the layer to draw 2D features into the GL context.
 *
 * The layer cannot make any assumptions about the current GL state.
 * The layer must not change any state related to the depth buffer.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name render3D
 * @param {WebGLRenderingContext} gl The map's gl context.
 * @param {Array<number>} matrix The map's camera matrix. It projects spherical mercator
 * coordinates to gl coordinates. The spherical mercator coordinate `[0, 0]` represents the
 * top left corner of the mercator world and `[1, 1]` represents the bottom right corner. The z coordinate
 * is conformal. A box with identical x, y, and z lengths in mercator units would be rendered as
 * a cube.
 */

/**
 * Called during a render frame allowing the layer to draw 3D features into the GL context.
 *
 * The layer cannot make any assumptions about the current GL state.
 * The layer must not change any state related to the depth buffer.
 * Correct feature order is only supported for opaque features.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name render
 * @param {WebGLRenderingContext} gl The map's gl context.
 * @param {Array<number>} matrix The map's camera matrix. It projects spherical mercator
 * coordinates to gl coordinates. The spherical mercator coordinate `[0, 0]` represents the
 * top left corner of the mercator world and `[1, 1]` represents the bottom right corner.
 */
export type CustomLayerInterface = {
    id: string,
    type: "custom",
    render: CustomRenderMethod,
    render3D: CustomRenderMethod,
    onAdd: (map: Map, gl: WebGLRenderingContext) => void,
    onRemove(map: Map): void
}

class CustomStyleLayer extends StyleLayer {

    implementation: CustomLayerInterface;
    viewportFrame: ?Framebuffer;

    constructor(implementation: CustomLayerInterface) {
        super(implementation, {});
        this.implementation = implementation;
    }


    hasOffscreenPass() {
        return this.implementation.render3D !== undefined;
    }

    recalculate() {}
    updateTransitions() {}
    hasTransition() {}

    serialize() {
        assert(false, "Custom layers cannot be serialized");
    }

    resize() {
        if (this.viewportFrame) {
            this.viewportFrame.destroy();
            this.viewportFrame = null;
        }
    }

    onAdd(map: Map) {
        if (this.implementation.onAdd) {
            this.implementation.onAdd(map, map.painter.context.gl);
        }
    }

    onRemove(map: Map) {
        if (this.implementation.onRemove) {
            this.implementation.onRemove(map);
        }
    }
}

export default CustomStyleLayer;
