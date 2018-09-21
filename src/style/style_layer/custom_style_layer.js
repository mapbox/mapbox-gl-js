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
 * They must implement `render` and may implement `prerender`, `onAdd` and `onRemove`.
 * They can trigger rendering using {@link Map#triggerRepaint}
 * and they should appropriately handle {@link Map.event:webglcontextlost} and
 * {@link Map.event:webglcontextrestored}.
 *
 * @interface CustomLayerInterface
 * @property {string} id A unique layer id.
 * @property {string} type The layer's type. Must be `"custom"`.
 * @property {string} renderingMode Either `"2d"` or `"3d"`. Defaults to `"2d"`.
 * @example
 * // Custom layer implemented as ES6 class
 * class NullIslandLayer {
 *     constructor() {
 *         this.id = 'null-island';
 *         this.type = 'custom';
 *         this.renderingMode = '2d';
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
 * Optional method called when the layer has been added to the Map with {@link Map#addLayer}. This
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
 * Optional method called when the layer has been removed from the Map with {@link Map#removeLayer}. This
 * gives the layer a chance to clean up gl resources and event listeners.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name onRemove
 * @param {Map} map The Map this custom layer was just added to.
 */

/**
 * Optional method called during a render frame to allow a layer to prepare resources or render into a texture.
 * 
 * The layer cannot make any assumptions about the current GL state and must bind a framebuffer before rendering.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name prerender
 * @param {WebGLRenderingContext} gl The map's gl context.
 * @param {Array<number>} matrix The map's camera matrix. It projects spherical mercator
 * coordinates to gl coordinates. The spherical mercator coordinate `[0, 0]` represents the
 * top left corner of the mercator world and `[1, 1]` represents the bottom right corner. When
 * the `renderingMode` is `"3d"`, the z coordinate is conformal. A box with identical x, y, and z
 * lengths in mercator units would be rendered as a cube.
 */

/**
 * Called during a render frame allowing the layer to draw into the GL context.
 *
 * The layer can assume blending and depth state is set to allow the layer to properly
 * blend and clip other layers. The layer cannot make any other assumptions about the
 * current GL state.
 *
 * If the layer needs to render to a texture, it should implement the `prerender` method
 * to do this and only use the `render` method for drawing directly into the main framebuffer.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name render
 * @param {WebGLRenderingContext} gl The map's gl context.
 * @param {Array<number>} matrix The map's camera matrix. It projects spherical mercator
 * coordinates to gl coordinates. The spherical mercator coordinate `[0, 0]` represents the
 * top left corner of the mercator world and `[1, 1]` represents the bottom right corner. When
 * the `renderingMode` is `"3d"`, the z coordinate is conformal. A box with identical x, y, and z
 * lengths in mercator units would be rendered as a cube.
 */
export type CustomLayerInterface = {
    id: string,
    type: "custom",
    renderingMode: "2d" | "3d",
    render: CustomRenderMethod,
    prerender: ?CustomRenderMethod,
    onAdd: ?(map: Map, gl: WebGLRenderingContext) => void,
    onRemove: ?(map: Map) => void
}

export function validateCustomStyleLayer(layerObject: CustomLayerInterface) {
    const errors = [];
    const id = layerObject.id;

    if (id === undefined) {
        errors.push({
            message: `layers.${id}: missing required property "id"`
        });
    }

    if (layerObject.render === undefined) {
        errors.push({
            message: `layers.${id}: missing required method "render"`
        });
    }

    if (layerObject.renderingMode &&
        layerObject.renderingMode !== '2d' &&
        layerObject.renderingMode !== '3d') {
        errors.push({
            message: `layers.${id}: property "renderingMode" must be either "2d" or "3d"`
        });
    }

    return errors;
}

class CustomStyleLayer extends StyleLayer {

    implementation: CustomLayerInterface;
    viewportFrame: ?Framebuffer;

    constructor(implementation: CustomLayerInterface) {
        super(implementation, {});
        this.implementation = implementation;
    }


    hasOffscreenPass() {
        return this.implementation.prerender !== undefined || this.implementation.renderingMode === '3d';
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
