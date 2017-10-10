// @flow

const Point = require('@mapbox/point-geometry');
const {SegmentVector} = require('../segment');
const VertexBuffer = require('../../gl/vertex_buffer');
const IndexBuffer = require('../../gl/index_buffer');
const {ProgramConfigurationSet} = require('../program_configuration');
const createVertexArrayType = require('../vertex_array_type');
const {TriangleIndexArray, LineIndexArray} = require('../index_array_type');
const EXTENT = require('../extent');
const {packUint8ToFloat} = require('../../shaders/encode_attribute');
const Anchor = require('../../symbol/anchor');
const getAnchors = require('../../symbol/get_anchors');
const resolveTokens = require('../../util/token');
const {getGlyphQuads, getIconQuads} = require('../../symbol/quads');
const {shapeText, shapeIcon, WritingMode} = require('../../symbol/shaping');
const transformText = require('../../symbol/transform_text');
const mergeLines = require('../../symbol/mergelines');
const clipLine = require('../../symbol/clip_line');
const util = require('../../util/util');
const scriptDetection = require('../../util/script_detection');
const loadGeometry = require('../load_geometry');
const CollisionFeature = require('../../symbol/collision_feature');
const findPoleOfInaccessibility = require('../../util/find_pole_of_inaccessibility');
const classifyRings = require('../../util/classify_rings');
const vectorTileFeatureTypes = require('@mapbox/vector-tile').VectorTileFeature.types;
const createStructArrayType = require('../../util/struct_array');
const verticalizePunctuation = require('../../util/verticalize_punctuation');
const {getSizeData} = require('../../symbol/symbol_size');

import type {Feature as ExpressionFeature} from '../../style-spec/expression';
import type {Bucket, BucketParameters, IndexedFeature, PopulateParameters} from '../bucket';
import type {ProgramInterface, SerializedProgramConfiguration} from '../program_configuration';
import type CollisionBoxArray, {CollisionBox} from '../../symbol/collision_box';
import type CollisionTile from '../../symbol/collision_tile';
import type {
    StructArray,
    SerializedStructArray
} from '../../util/struct_array';
import type SymbolStyleLayer from '../../style/style_layer/symbol_style_layer';
import type {Shaping, PositionedIcon} from '../../symbol/shaping';
import type {SymbolQuad} from '../../symbol/quads';
import type {SizeData} from '../../symbol/symbol_size';
import type {StyleImage} from '../../style/style_image';
import type {StyleGlyph} from '../../style/style_glyph';
import type {ImagePosition} from '../../render/image_atlas';
import type {GlyphPosition} from '../../render/glyph_atlas';

type SymbolBucketParameters = BucketParameters & {
    sdfIcons: boolean,
    iconsNeedLinear: boolean,
    fontstack: string,
    textSizeData: any,
    iconSizeData: any,
    placedGlyphArray: StructArray,
    placedIconArray: StructArray,
    glyphOffsetArray: StructArray,
    lineVertexArray: StructArray,
}

type SymbolInstance = {
    textBoxStartIndex: number,
    textBoxEndIndex: number,
    iconBoxStartIndex: number,
    iconBoxEndIndex: number,
    glyphQuads: Array<SymbolQuad>,
    iconQuads: Array<SymbolQuad>,
    textOffset: [number, number],
    iconOffset: [number, number],
    anchor: Anchor,
    line: Array<Point>,
    featureIndex: number,
    feature: ExpressionFeature,
    writingModes: number,
    textCollisionFeature?: {boxStartIndex: number, boxEndIndex: number},
    iconCollisionFeature?: {boxStartIndex: number, boxEndIndex: number}
};

export type SymbolFeature = {|
    text: string | void,
    icon: string | void,
    index: number,
    sourceLayerIndex: number,
    geometry: Array<Array<Point>>,
    properties: Object,
    type: 'Point' | 'LineString' | 'Polygon',
    id?: any
|};

type ShapedTextOrientations = {
    '1'?: Shaping,
    '2'?: Shaping
};

const PlacedSymbolArray = createStructArrayType({
    members: [
        { type: 'Int16', name: 'anchorX' },
        { type: 'Int16', name: 'anchorY' },
        { type: 'Uint16', name: 'glyphStartIndex' },
        { type: 'Uint16', name: 'numGlyphs' },
        { type: 'Uint32', name: 'lineStartIndex' },
        { type: 'Uint32', name: 'lineLength' },
        { type: 'Uint16', name: 'segment' },
        { type: 'Uint16', name: 'lowerSize' },
        { type: 'Uint16', name: 'upperSize' },
        { type: 'Float32', name: 'lineOffsetX' },
        { type: 'Float32', name: 'lineOffsetY' },
        { type: 'Float32', name: 'placementZoom' },
        { type: 'Uint8', name: 'vertical' }
    ]
});

const GlyphOffsetArray = createStructArrayType({
    members: [
        { type: 'Float32', name: 'offsetX' }
    ]
});

const LineVertexArray = createStructArrayType({
    members: [
        { type: 'Int16', name: 'x' },
        { type: 'Int16', name: 'y' }
    ]});

const layoutAttributes = [
    {name: 'a_pos_offset',  components: 4, type: 'Int16'},
    {name: 'a_data',        components: 4, type: 'Uint16'}
];

const dynamicLayoutAttributes = [
    { name: 'a_projected_pos', components: 3, type: 'Float32' }
];

const symbolInterfaces = {
    text: {
        layoutAttributes: layoutAttributes,
        dynamicLayoutAttributes: dynamicLayoutAttributes,
        indexArrayType: TriangleIndexArray,
        paintAttributes: [
            {property: 'text-color', name: 'fill_color'},
            {property: 'text-halo-color', name: 'halo_color'},
            {property: 'text-halo-width', name: 'halo_width'},
            {property: 'text-halo-blur', name: 'halo_blur'},
            {property: 'text-opacity', name: 'opacity'}
        ]
    },
    icon: {
        layoutAttributes: layoutAttributes,
        dynamicLayoutAttributes: dynamicLayoutAttributes,
        indexArrayType: TriangleIndexArray,
        paintAttributes: [
            {property: 'icon-color', name: 'fill_color'},
            {property: 'icon-halo-color', name: 'halo_color'},
            {property: 'icon-halo-width', name: 'halo_width'},
            {property: 'icon-halo-blur', name: 'halo_blur'},
            {property: 'icon-opacity', name: 'opacity'}
        ]
    },
    collisionBox: { // used to render collision boxes for debugging purposes
        layoutAttributes: [
            {name: 'a_pos',        components: 2, type: 'Int16'},
            {name: 'a_anchor_pos', components: 2, type: 'Int16'},
            {name: 'a_extrude',    components: 2, type: 'Int16'},
            {name: 'a_data',       components: 2, type: 'Uint8'}
        ],
        indexArrayType: LineIndexArray
    }
};

function addVertex(array, anchorX, anchorY, ox, oy, tx, ty, sizeVertex) {
    array.emplaceBack(
        // a_pos_offset
        anchorX,
        anchorY,
        Math.round(ox * 64),
        Math.round(oy * 64),

        // a_data
        tx, // x coordinate of symbol on glyph atlas texture
        ty, // y coordinate of symbol on glyph atlas texture
        sizeVertex ? sizeVertex[0] : undefined,
        sizeVertex ? sizeVertex[1] : undefined
    );
}

function addDynamicAttributes(dynamicLayoutVertexArray, p, angle, placementZoom) {
    const twoPi = Math.PI * 2;
    const angleAndZoom = packUint8ToFloat(
        ((angle + twoPi) % twoPi) / twoPi * 255,
        placementZoom * 10);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angleAndZoom);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angleAndZoom);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angleAndZoom);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angleAndZoom);
}

function addCollisionBoxVertex(layoutVertexArray, point, anchor, extrude, maxZoom, placementZoom) {
    return layoutVertexArray.emplaceBack(
        // pos
        point.x,
        point.y,
        // a_anchor_pos
        anchor.x,
        anchor.y,
        // extrude
        Math.round(extrude.x),
        Math.round(extrude.y),
        // data
        maxZoom * 10,
        placementZoom * 10);
}

type SerializedSymbolBuffer = {
    layoutVertexArray: SerializedStructArray,
    dynamicLayoutVertexArray: SerializedStructArray,
    indexArray: SerializedStructArray,
    programConfigurations: {[string]: ?SerializedProgramConfiguration},
    segments: Array<Object>,
};

class SymbolBuffers {
    programInterface: ProgramInterface;
    layoutVertexArray: StructArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: StructArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet;
    segments: SegmentVector;

    dynamicLayoutVertexArray: StructArray;
    dynamicLayoutVertexBuffer: VertexBuffer;

    constructor(programInterface: ProgramInterface, layers: Array<SymbolStyleLayer>, zoom: number, arrays?: SerializedSymbolBuffer) {
        this.programInterface = programInterface;

        const LayoutVertexArrayType = createVertexArrayType(programInterface.layoutAttributes);
        const IndexArrayType = programInterface.indexArrayType;

        this.layoutVertexArray = new LayoutVertexArrayType(arrays && arrays.layoutVertexArray);
        this.indexArray = new IndexArrayType(arrays && arrays.indexArray);
        this.programConfigurations = new ProgramConfigurationSet(programInterface, layers, zoom, arrays && arrays.programConfigurations);
        this.segments = new SegmentVector(arrays && arrays.segments);

        if (programInterface.dynamicLayoutAttributes) {
            const DynamicLayoutVertexArrayType = createVertexArrayType(programInterface.dynamicLayoutAttributes);
            this.dynamicLayoutVertexArray = new DynamicLayoutVertexArrayType(arrays && arrays.dynamicLayoutVertexArray);
        }
    }

    serialize(transferables?: Array<Transferable>): SerializedSymbolBuffer {
        return {
            layoutVertexArray: this.layoutVertexArray.serialize(transferables),
            indexArray: this.indexArray.serialize(transferables),
            programConfigurations: this.programConfigurations.serialize(transferables),
            segments: this.segments.get(),
            dynamicLayoutVertexArray: this.dynamicLayoutVertexArray && this.dynamicLayoutVertexArray.serialize(transferables),
        };
    }

    upload(gl: WebGLRenderingContext) {
        this.layoutVertexBuffer = new VertexBuffer(gl, this.layoutVertexArray);
        this.indexBuffer = new IndexBuffer(gl, this.indexArray);
        this.programConfigurations.upload(gl);

        if (this.programInterface.dynamicLayoutAttributes) {
            this.dynamicLayoutVertexBuffer = new VertexBuffer(gl, this.dynamicLayoutVertexArray, true);
        }
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        if (this.dynamicLayoutVertexBuffer) {
            this.dynamicLayoutVertexBuffer.destroy();
        }
    }
}

/**
 * Unlike other buckets, which simply implement #addFeature with type-specific
 * logic for (essentially) triangulating feature geometries, SymbolBucket
 * requires specialized behavior:
 *
 * 1. WorkerTile#parse(), the logical owner of the bucket creation process,
 *    calls SymbolBucket#populate(), which resolves text and icon tokens on
 *    each feature, adds each glyphs and symbols needed to the passed-in
 *    collections options.glyphDependencies and options.iconDependencies, and
 *    stores the feature data for use in subsequent step (this.features).
 *
 * 2. WorkerTile asynchronously requests from the main thread all of the glyphs
 *    and icons needed (by this bucket and any others). When glyphs and icons
 *    have been received, the WorkerTile creates a CollisionTile and invokes:
 *
 * 3. SymbolBucket#prepare(stacks, icons) to perform text shaping and layout,
 *    populating `this.symbolInstances` and `this.collisionBoxArray`.
 *
 * 4. SymbolBucket#place(collisionTile): taking collisions into account, decide
 *    on which labels and icons to actually draw and at which scale, populating
 *    the vertex arrays (`this.arrays.glyph`, `this.arrays.icon`) and thus
 *    completing the parsing / buffer population process.
 *
 * The reason that `prepare` and `place` are separate methods is that
 * `prepare`, being independent of pitch and orientation, only needs to happen
 * at tile load time, whereas `place` must be invoked on already-loaded tiles
 * when the pitch/orientation are changed. (See `redoPlacement`.)
 *
 * @private
 */
class SymbolBucket implements Bucket {
    static programInterfaces: {
        text: ProgramInterface,
        icon: ProgramInterface,
        collisionBox: ProgramInterface
    };

    static MAX_INSTANCES: number;
    static addDynamicAttributes: typeof addDynamicAttributes;

    collisionBoxArray: CollisionBoxArray;
    zoom: number;
    overscaling: number;
    layers: Array<SymbolStyleLayer>;
    index: number;
    sdfIcons: boolean;
    iconsNeedLinear: boolean;
    textSizeData: any;
    iconSizeData: any;
    placedGlyphArray: StructArray;
    placedIconArray: StructArray;
    glyphOffsetArray: StructArray;
    lineVertexArray: StructArray;
    features: Array<SymbolFeature>;
    symbolInstances: Array<SymbolInstance>;
    pixelRatio: number;
    tilePixelRatio: number;
    compareText: {[string]: Array<Point>};

    text: SymbolBuffers;
    icon: SymbolBuffers;
    collisionBox: SymbolBuffers;
    uploaded: boolean;

    constructor(options: SymbolBucketParameters) {
        this.collisionBoxArray = options.collisionBoxArray;
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;
        this.sdfIcons = options.sdfIcons;
        this.iconsNeedLinear = options.iconsNeedLinear;
        this.pixelRatio = options.pixelRatio;

        // deserializing a bucket created on a worker thread
        if (options.text) {
            this.text = new SymbolBuffers(symbolInterfaces.text, options.layers, options.zoom, options.text);
            this.icon = new SymbolBuffers(symbolInterfaces.icon, options.layers, options.zoom, options.icon);
            this.collisionBox = new SymbolBuffers(symbolInterfaces.collisionBox, options.layers, options.zoom, options.collisionBox);

            this.textSizeData = options.textSizeData;
            this.iconSizeData = options.iconSizeData;

            this.placedGlyphArray = new PlacedSymbolArray(options.placedGlyphArray);
            this.placedIconArray = new PlacedSymbolArray(options.placedIconArray);
            this.glyphOffsetArray = new GlyphOffsetArray(options.glyphOffsetArray);
            this.lineVertexArray = new LineVertexArray(options.lineVertexArray);

        } else {
            const layer = this.layers[0];
            this.textSizeData = getSizeData(this.zoom, layer, 'text-size');
            this.iconSizeData = getSizeData(this.zoom, layer, 'icon-size');
        }
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters) {
        const layer: SymbolStyleLayer = this.layers[0];
        const layout = layer.layout;
        const textFont = layout['text-font'];

        const hasText = (!layer.isLayoutValueFeatureConstant('text-field') || layout['text-field']) && textFont;
        const hasIcon = (!layer.isLayoutValueFeatureConstant('icon-image') || layout['icon-image']);

        this.features = [];

        if (!hasText && !hasIcon) {
            return;
        }

        const icons = options.iconDependencies;
        const stacks = options.glyphDependencies;
        const stack = stacks[textFont] = stacks[textFont] || {};
        const globalProperties =  {zoom: this.zoom};

        for (const {feature, index, sourceLayerIndex} of features) {
            if (!layer._featureFilter(globalProperties, feature)) {
                continue;
            }

            let text;
            if (hasText) {
                text = layer.getLayoutValue('text-field', globalProperties, feature);
                if (layer.isLayoutValueFeatureConstant('text-field')) {
                    text = resolveTokens(feature.properties, text);
                }
                text = transformText(text, layer, globalProperties, feature);
            }

            let icon;
            if (hasIcon) {
                icon = layer.getLayoutValue('icon-image', globalProperties, feature);
                if (layer.isLayoutValueFeatureConstant('icon-image')) {
                    icon = resolveTokens(feature.properties, icon);
                }
            }

            if (!text && !icon) {
                continue;
            }

            const symbolFeature: SymbolFeature = {
                text,
                icon,
                index,
                sourceLayerIndex,
                geometry: loadGeometry(feature),
                properties: feature.properties,
                type: vectorTileFeatureTypes[feature.type]
            };
            if (typeof feature.id !== 'undefined') {
                symbolFeature.id = feature.id;
            }
            this.features.push(symbolFeature);

            if (icon) {
                icons[icon] = true;
            }

            if (text) {
                const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
                const allowsVerticalWritingMode = scriptDetection.allowsVerticalWritingMode(text);
                for (let i = 0; i < text.length; i++) {
                    stack[text.charCodeAt(i)] = true;
                    if (textAlongLine && allowsVerticalWritingMode) {
                        const verticalChar = verticalizePunctuation.lookup[text.charAt(i)];
                        if (verticalChar) {
                            stack[verticalChar.charCodeAt(0)] = true;
                        }
                    }
                }
            }
        }

        if (layout['symbol-placement'] === 'line') {
            // Merge adjacent lines with the same text to improve labelling.
            // It's better to place labels on one long line than on many short segments.
            this.features = mergeLines(this.features);
        }
    }

    isEmpty() {
        return this.icon.layoutVertexArray.length === 0 &&
            this.text.layoutVertexArray.length === 0 &&
            this.collisionBox.layoutVertexArray.length === 0;
    }

    serialize(transferables?: Array<Transferable>) {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            sdfIcons: this.sdfIcons,
            iconsNeedLinear: this.iconsNeedLinear,
            textSizeData: this.textSizeData,
            iconSizeData: this.iconSizeData,
            placedGlyphArray: this.placedGlyphArray.serialize(transferables),
            placedIconArray: this.placedIconArray.serialize(transferables),
            glyphOffsetArray: this.glyphOffsetArray.serialize(transferables),
            lineVertexArray: this.lineVertexArray.serialize(transferables),
            text: this.text.serialize(transferables),
            icon: this.icon.serialize(transferables),
            collisionBox: this.collisionBox.serialize(transferables)
        };
    }

    upload(gl: WebGLRenderingContext) {
        this.text.upload(gl);
        this.icon.upload(gl);
        this.collisionBox.upload(gl);
    }

    destroy() {
        this.text.destroy();
        this.icon.destroy();
        this.collisionBox.destroy();
    }

    prepare(glyphMap: {[string]: {[number]: ?StyleGlyph}},
            glyphPositions: {[string]: {[number]: GlyphPosition}},
            imageMap: {[string]: StyleImage},
            imagePositions: {[string]: ImagePosition}) {
        this.symbolInstances = [];

        const tileSize = 512 * this.overscaling;
        this.tilePixelRatio = EXTENT / tileSize;
        this.compareText = {};
        this.iconsNeedLinear = false;

        const layout = this.layers[0].layout;

        const oneEm = 24;
        const lineHeight = layout['text-line-height'] * oneEm;

        const fontstack = layout['text-font'].join(',');
        const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
        const glyphs = glyphMap[fontstack] || {};
        const glyphPositionMap = glyphPositions[fontstack] || {};

        for (const feature of this.features) {

            const shapedTextOrientations = {};
            const text = feature.text;
            if (text) {
                const textOffset = this.layers[0].getLayoutValue('text-offset', {zoom: this.zoom}, feature).map((t)=> t * oneEm);
                const spacing = this.layers[0].getLayoutValue('text-letter-spacing', {zoom: this.zoom}, feature) * oneEm;
                const spacingIfAllowed = scriptDetection.allowsLetterSpacing(text) ? spacing : 0;
                const textAnchor = this.layers[0].getLayoutValue('text-anchor', {zoom: this.zoom}, feature);
                const textJustify = this.layers[0].getLayoutValue('text-justify', {zoom: this.zoom}, feature);
                const maxWidth = layout['symbol-placement'] !== 'line' ?
                    this.layers[0].getLayoutValue('text-max-width', {zoom: this.zoom}, feature) * oneEm :
                    0;

                const applyShaping = (text: string, writingMode: 1 | 2) => {
                    return shapeText(
                        text, glyphs, maxWidth, lineHeight, textAnchor, textJustify,
                        spacingIfAllowed, textOffset, oneEm, writingMode);
                };

                shapedTextOrientations[WritingMode.horizontal] = applyShaping(text, WritingMode.horizontal);

                if (scriptDetection.allowsVerticalWritingMode(text) && textAlongLine) {
                    shapedTextOrientations[WritingMode.vertical] = applyShaping(text, WritingMode.vertical);
                }
            }

            let shapedIcon;
            if (feature.icon) {
                const image = imageMap[feature.icon];
                if (image) {
                    shapedIcon = shapeIcon(
                        imagePositions[feature.icon],
                        this.layers[0].getLayoutValue('icon-offset', {zoom: this.zoom}, feature),
                        this.layers[0].getLayoutValue('icon-anchor', {zoom: this.zoom}, feature));
                    if (this.sdfIcons === undefined) {
                        this.sdfIcons = image.sdf;
                    } else if (this.sdfIcons !== image.sdf) {
                        util.warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                    }
                    if (image.pixelRatio !== this.pixelRatio) {
                        this.iconsNeedLinear = true;
                    } else if (layout['icon-rotate'] !== 0 || !this.layers[0].isLayoutValueFeatureConstant('icon-rotate')) {
                        this.iconsNeedLinear = true;
                    }
                }
            }

            if (shapedTextOrientations[WritingMode.horizontal] || shapedIcon) {
                this.addFeature(feature, shapedTextOrientations, shapedIcon, glyphPositionMap);
            }
        }
    }

    /**
     * Given a feature and its shaped text and icon data, add a 'symbol
     * instance' for each _possible_ placement of the symbol feature.
     * (SymbolBucket#place() selects which of these instances to send to the
     * renderer based on collisions with symbols in other layers from the same
     * source.)
     * @private
     */
    addFeature(feature: SymbolFeature,
               shapedTextOrientations: ShapedTextOrientations,
               shapedIcon: PositionedIcon | void,
               glyphPositionMap: {[number]: GlyphPosition}) {
        const layoutTextSize = this.layers[0].getLayoutValue('text-size', {zoom: this.zoom + 1}, feature);
        const layoutIconSize = this.layers[0].getLayoutValue('icon-size', {zoom: this.zoom + 1}, feature);

        const textOffset = this.layers[0].getLayoutValue('text-offset', {zoom: this.zoom }, feature);
        const iconOffset = this.layers[0].getLayoutValue('icon-offset', {zoom: this.zoom }, feature);

        // To reduce the number of labels that jump around when zooming we need
        // to use a text-size value that is the same for all zoom levels.
        // This calculates text-size at a high zoom level so that all tiles can
        // use the same value when calculating anchor positions.
        let textMaxSize = this.layers[0].getLayoutValue('text-size', {zoom: 18}, feature);
        if (textMaxSize === undefined) {
            textMaxSize = layoutTextSize;
        }

        const layout = this.layers[0].layout,
            glyphSize = 24,
            fontScale = layoutTextSize / glyphSize,
            textBoxScale = this.tilePixelRatio * fontScale,
            textMaxBoxScale = this.tilePixelRatio * textMaxSize / glyphSize,
            iconBoxScale = this.tilePixelRatio * layoutIconSize,
            symbolMinDistance = this.tilePixelRatio * layout['symbol-spacing'],
            avoidEdges = layout['symbol-avoid-edges'],
            textPadding = layout['text-padding'] * this.tilePixelRatio,
            iconPadding = layout['icon-padding'] * this.tilePixelRatio,
            textMaxAngle = layout['text-max-angle'] / 180 * Math.PI,
            textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
            iconAlongLine = layout['icon-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
            mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
                layout['text-ignore-placement'] || layout['icon-ignore-placement'],
            symbolPlacement = layout['symbol-placement'],
            textRepeatDistance = symbolMinDistance / 2;

        const addSymbolInstance = (line, anchor) => {
            const inside = !(anchor.x < 0 || anchor.x > EXTENT || anchor.y < 0 || anchor.y > EXTENT);

            if (avoidEdges && !inside) return;

            // Normally symbol layers are drawn across tile boundaries. Only symbols
            // with their anchors within the tile boundaries are added to the buffers
            // to prevent symbols from being drawn twice.
            //
            // Symbols in layers with overlap are sorted in the y direction so that
            // symbols lower on the canvas are drawn on top of symbols near the top.
            // To preserve this order across tile boundaries these symbols can't
            // be drawn across tile boundaries. Instead they need to be included in
            // the buffers for both tiles and clipped to tile boundaries at draw time.
            const addToBuffers = inside || mayOverlap;
            this.addSymbolInstance(anchor, line, shapedTextOrientations, shapedIcon, this.layers[0],
                addToBuffers, this.collisionBoxArray, feature.index, feature.sourceLayerIndex, this.index,
                textBoxScale, textPadding, textAlongLine, textOffset,
                iconBoxScale, iconPadding, iconAlongLine, iconOffset,
                {zoom: this.zoom}, feature, glyphPositionMap);
        };

        if (symbolPlacement === 'line') {
            for (const line of clipLine(feature.geometry, 0, 0, EXTENT, EXTENT)) {
                const anchors = getAnchors(
                    line,
                    symbolMinDistance,
                    textMaxAngle,
                    shapedTextOrientations[WritingMode.vertical] || shapedTextOrientations[WritingMode.horizontal],
                    shapedIcon,
                    glyphSize,
                    textMaxBoxScale,
                    this.overscaling,
                    EXTENT
                );
                for (const anchor of anchors) {
                    const shapedText = shapedTextOrientations[WritingMode.horizontal];
                    if (!shapedText || !this.anchorIsTooClose(shapedText.text, textRepeatDistance, anchor)) {
                        addSymbolInstance(line, anchor);
                    }
                }
            }
        } else if (feature.type === 'Polygon') {
            for (const polygon of classifyRings(feature.geometry, 0)) {
                // 16 here represents 2 pixels
                const poi = findPoleOfInaccessibility(polygon, 16);
                addSymbolInstance(polygon[0], new Anchor(poi.x, poi.y, 0));
            }
        } else if (feature.type === 'LineString') {
            // https://github.com/mapbox/mapbox-gl-js/issues/3808
            for (const line of feature.geometry) {
                addSymbolInstance(line, new Anchor(line[0].x, line[0].y, 0));
            }
        } else if (feature.type === 'Point') {
            for (const points of feature.geometry) {
                for (const point of points) {
                    addSymbolInstance([point], new Anchor(point.x, point.y, 0));
                }
            }
        }
    }

    anchorIsTooClose(text: string, repeatDistance: number, anchor: Point) {
        const compareText = this.compareText;
        if (!(text in compareText)) {
            compareText[text] = [];
        } else {
            const otherAnchors = compareText[text];
            for (let k = otherAnchors.length - 1; k >= 0; k--) {
                if (anchor.dist(otherAnchors[k]) < repeatDistance) {
                    // If it's within repeatDistance of one anchor, stop looking
                    return true;
                }
            }
        }
        // If anchor is not within repeatDistance of any other anchor, add to array
        compareText[text].push(anchor);
        return false;
    }

    place(collisionTile: CollisionTile, showCollisionBoxes: boolean) {
        // Calculate which labels can be shown and when they can be shown and
        // create the bufers used for rendering.

        this.text = new SymbolBuffers(symbolInterfaces.text, this.layers, this.zoom);
        this.icon = new SymbolBuffers(symbolInterfaces.icon, this.layers, this.zoom);
        this.collisionBox = new SymbolBuffers(symbolInterfaces.collisionBox, this.layers, this.zoom);

        this.placedGlyphArray = new PlacedSymbolArray();
        this.placedIconArray = new PlacedSymbolArray();
        this.glyphOffsetArray = new GlyphOffsetArray();
        this.lineVertexArray = new LineVertexArray();

        const layer = this.layers[0];
        const layout = layer.layout;

        // Symbols that don't show until greater than the CollisionTile's maxScale won't even be added
        // to the buffers. Even though pan operations on a tilted map might cause the symbol to be
        // displayable, we have to stay conservative here because the CollisionTile didn't consider
        // this scale range.
        const maxScale = collisionTile.maxScale;

        const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
        const iconAlongLine = layout['icon-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';

        const mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
            layout['text-ignore-placement'] || layout['icon-ignore-placement'];

        // Sort symbols by their y position on the canvas so that the lower symbols
        // are drawn on top of higher symbols.
        // Don't sort symbols that won't overlap because it isn't necessary and
        // because it causes more labels to pop in and out when rotating.
        if (mayOverlap) {
            const angle = collisionTile.angle;

            const sin = Math.sin(angle),
                cos = Math.cos(angle);

            this.symbolInstances.sort((a, b) => {
                const aRotated = (sin * a.anchor.x + cos * a.anchor.y) | 0;
                const bRotated = (sin * b.anchor.x + cos * b.anchor.y) | 0;
                return (aRotated - bRotated) || (b.featureIndex - a.featureIndex);
            });
        }

        for (const symbolInstance of this.symbolInstances) {
            const textCollisionFeature = {
                boxStartIndex: symbolInstance.textBoxStartIndex,
                boxEndIndex: symbolInstance.textBoxEndIndex
            };
            const iconCollisionFeature = {
                boxStartIndex: symbolInstance.iconBoxStartIndex,
                boxEndIndex: symbolInstance.iconBoxEndIndex
            };

            const hasText = !(symbolInstance.textBoxStartIndex === symbolInstance.textBoxEndIndex);
            const hasIcon = !(symbolInstance.iconBoxStartIndex === symbolInstance.iconBoxEndIndex);

            const iconWithoutText = layout['text-optional'] || !hasText,
                textWithoutIcon = layout['icon-optional'] || !hasIcon;


            // Calculate the scales at which the text and icon can be placed without collision.

            let glyphScale = hasText ?
                collisionTile.placeCollisionFeature(textCollisionFeature,
                    layout['text-allow-overlap'], layout['symbol-avoid-edges']) :
                collisionTile.minScale;

            let iconScale = hasIcon ?
                collisionTile.placeCollisionFeature(iconCollisionFeature,
                    layout['icon-allow-overlap'], layout['symbol-avoid-edges']) :
                collisionTile.minScale;


            // Combine the scales for icons and text.

            if (!iconWithoutText && !textWithoutIcon) {
                iconScale = glyphScale = Math.max(iconScale, glyphScale);
            } else if (!textWithoutIcon && glyphScale) {
                glyphScale = Math.max(iconScale, glyphScale);
            } else if (!iconWithoutText && iconScale) {
                iconScale = Math.max(iconScale, glyphScale);
            }


            // Insert final placement into collision tree and add glyphs/icons to buffers
            if (!hasText && !hasIcon) continue;
            const line = symbolInstance.line;
            const lineStartIndex = this.lineVertexArray.length;
            for (let i = 0; i < line.length; i++) {
                this.lineVertexArray.emplaceBack(line[i].x, line[i].y);
            }
            const lineLength = this.lineVertexArray.length - lineStartIndex;


            if (hasText) {
                collisionTile.insertCollisionFeature(textCollisionFeature, glyphScale, layout['text-ignore-placement']);
                if (glyphScale <= maxScale) {
                    const textSizeData = getSizeVertexData(layer,
                        this.zoom,
                        this.textSizeData,
                        'text-size',
                        symbolInstance.feature);
                    this.addSymbols(
                        this.text,
                        symbolInstance.glyphQuads,
                        glyphScale,
                        textSizeData,
                        layout['text-keep-upright'],
                        symbolInstance.textOffset,
                        textAlongLine,
                        collisionTile.angle,
                        symbolInstance.feature,
                        symbolInstance.writingModes,
                        symbolInstance.anchor,
                        lineStartIndex,
                        lineLength,
                        this.placedGlyphArray);
                }
            }

            if (hasIcon) {
                collisionTile.insertCollisionFeature(iconCollisionFeature, iconScale, layout['icon-ignore-placement']);
                if (iconScale <= maxScale) {
                    const iconSizeData = getSizeVertexData(
                        layer,
                        this.zoom,
                        this.iconSizeData,
                        'icon-size',
                        symbolInstance.feature);
                    this.addSymbols(
                        this.icon,
                        symbolInstance.iconQuads,
                        iconScale,
                        iconSizeData,
                        layout['icon-keep-upright'],
                        symbolInstance.iconOffset,
                        iconAlongLine,
                        collisionTile.angle,
                        symbolInstance.feature,
                        0,
                        symbolInstance.anchor,
                        lineStartIndex,
                        lineLength,
                        this.placedIconArray
                    );
                }
            }

        }

        if (showCollisionBoxes) this.addToDebugBuffers(collisionTile);
    }

    addSymbols(arrays: SymbolBuffers,
               quads: Array<SymbolQuad>,
               scale: number,
               sizeVertex: any,
               keepUpright: boolean,
               lineOffset: [number, number],
               alongLine: boolean,
               placementAngle: number,
               feature: ExpressionFeature,
               writingModes: number,
               labelAnchor: Anchor,
               lineStartIndex: number,
               lineLength: number,
               placedSymbolArray: StructArray) {
        const indexArray = arrays.indexArray;
        const layoutVertexArray = arrays.layoutVertexArray;
        const dynamicLayoutVertexArray = arrays.dynamicLayoutVertexArray;

        const zoom = this.zoom;
        const placementZoom = Math.max(Math.log(scale) / Math.LN2 + zoom, 0);

        const glyphOffsetArrayStart = this.glyphOffsetArray.length;

        const labelAngle = ((labelAnchor.angle + placementAngle) + 2 * Math.PI) % (2 * Math.PI);
        const inVerticalRange = (
            (labelAngle > Math.PI * 1 / 4 && labelAngle <= Math.PI * 3 / 4) ||
            (labelAngle > Math.PI * 5 / 4 && labelAngle <= Math.PI * 7 / 4));
        const useVerticalMode = Boolean(writingModes & WritingMode.vertical) && inVerticalRange;

        for (const symbol of quads) {

            if (alongLine && keepUpright) {
                // drop incorrectly oriented glyphs
                if ((symbol.writingMode === WritingMode.vertical) !== useVerticalMode) continue;
            }

            const tl = symbol.tl,
                tr = symbol.tr,
                bl = symbol.bl,
                br = symbol.br,
                tex = symbol.tex;

            const segment = arrays.segments.prepareSegment(4, arrays.layoutVertexArray, arrays.indexArray);
            const index = segment.vertexLength;

            const y = symbol.glyphOffset[1];
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tl.x, y + tl.y, tex.x, tex.y, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tr.x, y + tr.y, tex.x + tex.w, tex.y, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, bl.x, y + bl.y, tex.x, tex.y + tex.h, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, br.x, y + br.y, tex.x + tex.w, tex.y + tex.h, sizeVertex);

            addDynamicAttributes(dynamicLayoutVertexArray, labelAnchor, 0, placementZoom);

            indexArray.emplaceBack(index, index + 1, index + 2);
            indexArray.emplaceBack(index + 1, index + 2, index + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;

            this.glyphOffsetArray.emplaceBack(symbol.glyphOffset[0]);
        }

        placedSymbolArray.emplaceBack(labelAnchor.x, labelAnchor.y,
            glyphOffsetArrayStart, this.glyphOffsetArray.length - glyphOffsetArrayStart,
            lineStartIndex, lineLength, labelAnchor.segment,
            sizeVertex ? sizeVertex[0] : 0, sizeVertex ? sizeVertex[1] : 0,
            lineOffset[0], lineOffset[1],
            placementZoom, useVerticalMode);

        arrays.programConfigurations.populatePaintArrays(arrays.layoutVertexArray.length, feature);
    }

    addToDebugBuffers(collisionTile: CollisionTile) {
        const arrays = this.collisionBox;
        const layoutVertexArray = arrays.layoutVertexArray;
        const indexArray = arrays.indexArray;

        const angle = -collisionTile.angle;
        const yStretch = collisionTile.yStretch;

        for (const symbolInstance of this.symbolInstances) {
            symbolInstance.textCollisionFeature = {boxStartIndex: symbolInstance.textBoxStartIndex, boxEndIndex: symbolInstance.textBoxEndIndex};
            symbolInstance.iconCollisionFeature = {boxStartIndex: symbolInstance.iconBoxStartIndex, boxEndIndex: symbolInstance.iconBoxEndIndex};

            for (let i = 0; i < 2; i++) {
                const feature = symbolInstance[i === 0 ? 'textCollisionFeature' : 'iconCollisionFeature'];
                if (!feature) continue;

                for (let b = feature.boxStartIndex; b < feature.boxEndIndex; b++) {
                    const box: CollisionBox = (this.collisionBoxArray.get(b): any);
                    if (collisionTile.perspectiveRatio === 1 && box.maxScale < 1) {
                        // These boxes aren't used on unpitched maps
                        // See CollisionTile#insertCollisionFeature
                        continue;
                    }
                    const boxAnchorPoint = box.anchorPoint;

                    const tl = new Point(box.x1, box.y1 * yStretch)._rotate(angle);
                    const tr = new Point(box.x2, box.y1 * yStretch)._rotate(angle);
                    const bl = new Point(box.x1, box.y2 * yStretch)._rotate(angle);
                    const br = new Point(box.x2, box.y2 * yStretch)._rotate(angle);

                    const maxZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.maxScale) / Math.LN2));
                    const placementZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.placementScale) / Math.LN2));

                    const segment = arrays.segments.prepareSegment(4, arrays.layoutVertexArray, arrays.indexArray);
                    const index = segment.vertexLength;

                    addCollisionBoxVertex(layoutVertexArray, boxAnchorPoint, symbolInstance.anchor, tl, maxZoom, placementZoom);
                    addCollisionBoxVertex(layoutVertexArray, boxAnchorPoint, symbolInstance.anchor, tr, maxZoom, placementZoom);
                    addCollisionBoxVertex(layoutVertexArray, boxAnchorPoint, symbolInstance.anchor, br, maxZoom, placementZoom);
                    addCollisionBoxVertex(layoutVertexArray, boxAnchorPoint, symbolInstance.anchor, bl, maxZoom, placementZoom);

                    indexArray.emplaceBack(index, index + 1);
                    indexArray.emplaceBack(index + 1, index + 2);
                    indexArray.emplaceBack(index + 2, index + 3);
                    indexArray.emplaceBack(index + 3, index);

                    segment.vertexLength += 4;
                    segment.primitiveLength += 4;
                }
            }
        }
    }

    /**
     * Add a single label & icon placement.
     *
     * Note that in the case of `symbol-placement: line`, the symbol instance's
     * array of glyph 'quads' may include multiple copies of each glyph,
     * corresponding to the different orientations it might take at different
     * zoom levels as the text goes around bends in the line.
     *
     * As such, each glyph quad includes a minzoom and maxzoom at which it
     * should be rendered.  This zoom range is calculated based on the 'layout'
     * {text,icon} size -- i.e. text/icon-size at `z: tile.zoom + 1`. If the
     * size is zoom-dependent, then the zoom range is adjusted at render time
     * to account for the difference.
     *
     * @private
     */
    addSymbolInstance(anchor: Anchor,
                      line: Array<Point>,
                      shapedTextOrientations: ShapedTextOrientations,
                      shapedIcon: PositionedIcon | void,
                      layer: SymbolStyleLayer,
                      addToBuffers: boolean,
                      collisionBoxArray: CollisionBoxArray,
                      featureIndex: number,
                      sourceLayerIndex: number,
                      bucketIndex: number,
                      textBoxScale: number,
                      textPadding: number,
                      textAlongLine: boolean,
                      textOffset: [number, number],
                      iconBoxScale: number,
                      iconPadding: number,
                      iconAlongLine: boolean,
                      iconOffset: [number, number],
                      globalProperties: Object,
                      feature: SymbolFeature,
                      glyphPositionMap: {[number]: GlyphPosition}) {

        let textCollisionFeature, iconCollisionFeature;
        let iconQuads = [];
        let glyphQuads = [];
        for (const writingModeString in shapedTextOrientations) {
            const writingMode = parseInt(writingModeString, 10);
            if (!shapedTextOrientations[writingMode]) continue;
            glyphQuads = glyphQuads.concat(addToBuffers ?
                getGlyphQuads(anchor, shapedTextOrientations[writingMode],
                    layer, textAlongLine, globalProperties, feature, glyphPositionMap) :
                []);
            textCollisionFeature = new CollisionFeature(collisionBoxArray,
                line,
                anchor,
                featureIndex,
                sourceLayerIndex,
                bucketIndex,
                shapedTextOrientations[writingMode],
                textBoxScale,
                textPadding,
                textAlongLine,
                false);
        }

        const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : this.collisionBoxArray.length;
        const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : this.collisionBoxArray.length;

        if (shapedIcon) {
            iconQuads = addToBuffers ?
                getIconQuads(anchor, shapedIcon, layer,
                    iconAlongLine, shapedTextOrientations[WritingMode.horizontal],
                    globalProperties, feature) :
                [];
            iconCollisionFeature = new CollisionFeature(collisionBoxArray,
                line,
                anchor,
                featureIndex,
                sourceLayerIndex,
                bucketIndex,
                shapedIcon,
                iconBoxScale,
                iconPadding,
                iconAlongLine,
                true);
        }

        const iconBoxStartIndex = iconCollisionFeature ? iconCollisionFeature.boxStartIndex : this.collisionBoxArray.length;
        const iconBoxEndIndex = iconCollisionFeature ? iconCollisionFeature.boxEndIndex : this.collisionBoxArray.length;

        if (textBoxEndIndex > SymbolBucket.MAX_INSTANCES) {
            util.warnOnce("Too many symbols being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");
        }
        if (iconBoxEndIndex > SymbolBucket.MAX_INSTANCES) {
            util.warnOnce("Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");
        }

        const writingModes = (
            (shapedTextOrientations[WritingMode.vertical] ? WritingMode.vertical : 0) |
            (shapedTextOrientations[WritingMode.horizontal] ? WritingMode.horizontal : 0)
        );

        this.symbolInstances.push({
            textBoxStartIndex,
            textBoxEndIndex,
            iconBoxStartIndex,
            iconBoxEndIndex,
            glyphQuads,
            iconQuads,
            textOffset,
            iconOffset,
            anchor,
            line,
            featureIndex,
            feature,
            writingModes
        });
    }
}

function getSizeVertexData(layer: SymbolStyleLayer, tileZoom: number, sizeData: SizeData, sizeProperty, feature) {
    if (sizeData.functionType === 'source') {
        return [
            10 * layer.getLayoutValue(sizeProperty, ({}: any), feature)
        ];
    } else if (sizeData.functionType === 'composite') {
        const zoomRange = sizeData.coveringZoomRange;
        return [
            10 * layer.getLayoutValue(sizeProperty, {zoom: zoomRange[0]}, feature),
            10 * layer.getLayoutValue(sizeProperty, {zoom: zoomRange[1]}, feature)
        ];
    }
    return null;
}

SymbolBucket.programInterfaces = symbolInterfaces;

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, iconBoxEndIndex and textBoxEndIndex
// eg the max valid UInt16 is 65,535
SymbolBucket.MAX_INSTANCES = 65535;

SymbolBucket.addDynamicAttributes = addDynamicAttributes;

module.exports = SymbolBucket;
