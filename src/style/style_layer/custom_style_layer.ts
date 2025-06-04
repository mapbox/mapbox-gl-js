import StyleLayer from '../style_layer';
import assert from 'assert';

import type {Map} from '../../ui/map';
import type {ValidationError, ValidationErrors} from '../validate_style';
import type {ProjectionSpecification} from '../../style-spec/types';
import type SourceCache from '../../source/source_cache';

type CustomLayerRenderMethod = (
    gl: WebGL2RenderingContext,
    matrix: Array<number>,
    projection?: ProjectionSpecification,
    projectionToMercatorMatrix?: Array<number>,
    projectionToMercatorTransition?: number,
    centerInMercator?: Array<number>,
    pixelsPerMeterRatio?: number,
) => void;

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
 * The `renderingMode` property controls whether the layer is treated as a `"2d"` or `"3d"` map layer. Use:
 * - `"renderingMode": "3d"` to use the depth buffer and share it with other layers
 * - `"renderingMode": "2d"` to add a layer with no depth. If you need to use the depth buffer for a `"2d"` layer you must use an offscreen
 *   framebuffer and {@link CustomLayerInterface#prerender}.
 *
 * @interface CustomLayerInterface
 * @property {string} id A unique layer id.
 * @property {string} type The layer's type. Must be `"custom"`.
 * @property {string} renderingMode Either `"2d"` or `"3d"`. Defaults to `"2d"`.
 * @property {boolean} wrapTileId If `renderWorldCopies` is enabled `renderToTile` of the custom layer method will be called with different `x` value of the tile rendered on different copies of the world unless `wrapTileId` is set to `true`. Defaults to `false`.
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
 * map.on('load', () => {
 *     map.addLayer(new NullIslandLayer());
 * });
 * @see [Example: Add a custom style layer](https://docs.mapbox.com/mapbox-gl-js/example/custom-style-layer/)
 * @see [Example: Add a 3D model](https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model/)
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
 * @param {WebGL2RenderingContext} gl The gl context for the map.
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
 * @param {WebGL2RenderingContext} gl The gl context for the map.
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
 * @param {WebGL2RenderingContext} gl The map's gl context.
 * @param {Array<number>} matrix The map's camera matrix. It projects spherical mercator
 * coordinates to gl coordinates. The mercator coordinate `[0, 0]` represents the
 * top left corner of the mercator world and `[1, 1]` represents the bottom right corner. When
 * the `renderingMode` is `"3d"`, the z coordinate is conformal. A box with identical x, y, and z
 * lengths in mercator units would be rendered as a cube. {@link MercatorCoordinate#fromLngLat}
 * can be used to project a `LngLat` to a mercator coordinate.
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
 * The blend function is set to `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`. This expects
 * colors to be provided in premultiplied alpha form where the `r`, `g` and `b` values are already
 * multiplied by the `a` value. If you are unable to provide colors in premultiplied form you
 * may want to change the blend function to
 * `gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`.
 *
 * @function
 * @memberof CustomLayerInterface
 * @instance
 * @name render
 * @param {WebGL2RenderingContext} gl The map's gl context.
 * @param {Array<number>} matrix The map's camera matrix. It projects spherical mercator
 * coordinates to gl coordinates. The spherical mercator coordinate `[0, 0]` represents the
 * top left corner of the mercator world and `[1, 1]` represents the bottom right corner. When
 * the `renderingMode` is `"3d"`, the z coordinate is conformal. A box with identical x, y, and z
 * lengths in mercator units would be rendered as a cube. {@link MercatorCoordinate#fromLngLat}
 * can be used to project a `LngLat` to a mercator coordinate.
 */

/**
 * Called for every tile of a map with enabled terrain or globe projection.
 * By default it passes the unwrapped tile ID of corresponding tile.
 * You can use `wrapTileId` to pass the wrapped tile ID.
 *
 * The layer can assume blending and depth state is set to allow the layer to properly
 * blend and clip other layers. The layer cannot make any other assumptions about the
 * current GL state.
 *
 * @function
 * @memberof CustomLayerInterface
 * @name renderToTile
 * @param {WebGL2RenderingContext} gl The map's gl context.
 * @param {{ z: number, x: number, y: number }} tileId Tile ID to render to.
 */
export interface CustomLayerInterface {
    id: string;
    type: 'custom';
    slot?: string;
    renderingMode?: '2d' | '3d';
    wrapTileId?: boolean;
    render: CustomLayerRenderMethod;
    prerender?: CustomLayerRenderMethod;
    renderToTile?: (gl: WebGL2RenderingContext, tileId: {z: number, x: number, y: number}) => void;
    shouldRerenderTiles?: () => boolean;
    onAdd?: (map: Map, gl: WebGL2RenderingContext) => void;
    onRemove?: (map: Map, gl: WebGL2RenderingContext) => void;

    source?: never;
    'source-layer'?: never;
    minzoom?: never;
    maxzoom?: never;
    filter?: never;
    layout?: never;
    paint?: never;
}

export function validateCustomStyleLayer(layerObject: CustomLayerInterface): ValidationErrors {
    const errors: ValidationError[] = [];
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
    override type: 'custom';

    implementation: CustomLayerInterface;

    constructor(implementation: CustomLayerInterface, scope: string) {
        super(implementation, {}, scope, null);
        this.implementation = implementation;
        if (implementation.slot) this.slot = implementation.slot;
    }

    override is3D(terrainEnabled?: boolean): boolean {
        return this.implementation.renderingMode === '3d';
    }

    override hasOffscreenPass(): boolean {
        return this.implementation.prerender !== undefined;
    }

    override isDraped(_?: SourceCache | null): boolean {
        return this.implementation.renderToTile !== undefined;
    }

    shouldRedrape(): boolean {
        return !!this.implementation.shouldRerenderTiles && this.implementation.shouldRerenderTiles();
    }

    override recalculate() {}
    override updateTransitions() {}
    override hasTransition(): boolean {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    override serialize(): any {
        assert(false, "Custom layers cannot be serialized");
    }

    override onAdd(map: Map) {
        if (this.implementation.onAdd) {
            this.implementation.onAdd(map, map.painter.context.gl);
        }
    }

    override onRemove(map: Map) {
        if (this.implementation.onRemove) {
            this.implementation.onRemove(map, map.painter.context.gl);
        }
    }
}

export default CustomStyleLayer;
