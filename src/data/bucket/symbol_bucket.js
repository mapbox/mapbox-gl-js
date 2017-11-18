// @flow

const Point = require('@mapbox/point-geometry');
const {SegmentVector} = require('../segment');
const VertexBuffer = require('../../gl/vertex_buffer');
const IndexBuffer = require('../../gl/index_buffer');
const {ProgramConfigurationSet} = require('../program_configuration');
const createVertexArrayType = require('../vertex_array_type');
const {TriangleIndexArray, LineIndexArray} = require('../index_array_type');
const transformText = require('../../symbol/transform_text');
const mergeLines = require('../../symbol/mergelines');
const scriptDetection = require('../../util/script_detection');
const loadGeometry = require('../load_geometry');
const vectorTileFeatureTypes = require('@mapbox/vector-tile').VectorTileFeature.types;
const createStructArrayType = require('../../util/struct_array');
const verticalizePunctuation = require('../../util/verticalize_punctuation');
const Anchor = require('../../symbol/anchor');
const OpacityState = require('../../symbol/opacity_state');
const {getSizeData} = require('../../symbol/symbol_size');

import type {Feature as ExpressionFeature} from '../../style-spec/expression';
import type {Bucket, IndexedFeature, PopulateParameters} from '../bucket';
import type {ProgramInterface, SerializedProgramConfiguration} from '../program_configuration';
import type CollisionBoxArray, {CollisionBox} from '../../symbol/collision_box';
import type {
    StructArray,
    SerializedStructArray
} from '../../util/struct_array';
import type SymbolStyleLayer from '../../style/style_layer/symbol_style_layer';
import type {SymbolQuad} from '../../symbol/quads';
import type {SizeData} from '../../symbol/symbol_size';
import type {PossiblyEvaluatedPropertyValue} from '../../style/properties';

export type SingleCollisionBox = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    anchorPointX: number;
    anchorPointY: number;
};

export type CollisionArrays = {
    textBox?: SingleCollisionBox;
    iconBox?: SingleCollisionBox;
    textCircles?: Array<number>;
};

export type SymbolInstance = {
    key: string,
    textBoxStartIndex: number,
    textBoxEndIndex: number,
    iconBoxStartIndex: number,
    iconBoxEndIndex: number,
    textOffset: [number, number],
    iconOffset: [number, number],
    anchor: Anchor,
    line: Array<Point>,
    featureIndex: number,
    feature: ExpressionFeature,
    textCollisionFeature?: {boxStartIndex: number, boxEndIndex: number},
    iconCollisionFeature?: {boxStartIndex: number, boxEndIndex: number},
    placedTextSymbolIndices: Array<number>;
    numGlyphVertices: number;
    numVerticalGlyphVertices: number;
    numIconVertices: number;
    // Populated/modified on foreground during placement
    isDuplicate: boolean;
    textOpacityState: OpacityState;
    iconOpacityState: OpacityState;
    collisionArrays?: CollisionArrays;
    placedText?: boolean;
    placedIcon?: boolean;
    hidden?: boolean;
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

const PlacedSymbolArray = createStructArrayType({
    members: [
        { type: 'Int16', name: 'anchorX' },
        { type: 'Int16', name: 'anchorY' },
        { type: 'Uint16', name: 'glyphStartIndex' },
        { type: 'Uint16', name: 'numGlyphs' },
        { type: 'Uint32', name: 'vertexStartIndex' },
        { type: 'Uint32', name: 'lineStartIndex' },
        { type: 'Uint32', name: 'lineLength' },
        { type: 'Uint16', name: 'segment' },
        { type: 'Uint16', name: 'lowerSize' },
        { type: 'Uint16', name: 'upperSize' },
        { type: 'Float32', name: 'lineOffsetX' },
        { type: 'Float32', name: 'lineOffsetY' },
        { type: 'Uint8', name: 'writingMode' },
        { type: 'Uint8', name: 'hidden' }
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
        { type: 'Int16', name: 'y' },
        { type: 'Int16', name: 'tileUnitDistanceFromAnchor' }
    ]});

const layoutAttributes = [
    {name: 'a_pos_offset',  components: 4, type: 'Int16'},
    {name: 'a_data',        components: 4, type: 'Uint16'}
];

const dynamicLayoutAttributes = [
    { name: 'a_projected_pos', components: 3, type: 'Float32' }
];

// Opacity arrays are frequently updated but don't contain a lot of information, so we pack them
// tight. Each Uint32 is actually four duplicate Uint8s for the four corners of a glyph
// 7 bits are for the current opacity, and the lowest bit is the target opacity
const placementOpacityAttributes = [
    { name: 'a_fade_opacity', components: 1, type: 'Uint32' }
];
const shaderOpacityAttributes = [
    { name: 'a_fade_opacity', components: 1, type: 'Uint8', offset: 0 }
];

const collisionAttributes = [
    { name: 'a_placed', components: 2, type: 'Uint8' }
];

const symbolInterfaces = {
    text: {
        layoutAttributes: layoutAttributes,
        dynamicLayoutAttributes: dynamicLayoutAttributes,
        indexArrayType: TriangleIndexArray,
        opacityAttributes: placementOpacityAttributes,
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
        opacityAttributes: placementOpacityAttributes,
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
            {name: 'a_extrude',    components: 2, type: 'Int16'}
        ],
        indexArrayType: LineIndexArray,
        collisionAttributes: collisionAttributes
    },
    collisionCircle: { // used to render collision circles for debugging purposes
        layoutAttributes: [
            {name: 'a_pos',        components: 2, type: 'Int16'},
            {name: 'a_anchor_pos', components: 2, type: 'Int16'},
            {name: 'a_extrude',    components: 2, type: 'Int16'}
        ],
        collisionAttributes: collisionAttributes,
        indexArrayType: TriangleIndexArray
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

function addDynamicAttributes(dynamicLayoutVertexArray, p, angle) {
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
}

type SerializedSymbolBuffer = {
    layoutVertexArray: SerializedStructArray,
    dynamicLayoutVertexArray: SerializedStructArray,
    indexArray: SerializedStructArray,
    opacityVertexArray: SerializedStructArray,
    collisionVertexArray: SerializedStructArray,
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

    opacityVertexArray: StructArray;
    opacityVertexBuffer: VertexBuffer;

    collisionVertexArray: StructArray;
    collisionVertexBuffer: VertexBuffer;

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

        if (programInterface.opacityAttributes) {
            const OpacityVertexArrayType = createVertexArrayType(programInterface.opacityAttributes);
            this.opacityVertexArray = new OpacityVertexArrayType(arrays && arrays.opacityVertexArray);
        }

        if (programInterface.collisionAttributes) {
            const CollisionVertexArrayType = createVertexArrayType(programInterface.collisionAttributes);
            this.collisionVertexArray = new CollisionVertexArrayType(arrays && arrays.collisionVertexArray);
        }

    }

    serialize(transferables?: Array<Transferable>): SerializedSymbolBuffer {
        return {
            layoutVertexArray: this.layoutVertexArray.serialize(transferables),
            indexArray: this.indexArray.serialize(transferables),
            programConfigurations: this.programConfigurations.serialize(transferables),
            segments: this.segments.get(),
            dynamicLayoutVertexArray: this.dynamicLayoutVertexArray && this.dynamicLayoutVertexArray.serialize(transferables),
            opacityVertexArray: this.opacityVertexArray && this.opacityVertexArray.serialize(transferables),
            collisionVertexArray: this.collisionVertexArray && this.collisionVertexArray.serialize(transferables)
        };
    }

    upload(gl: WebGLRenderingContext, dynamicIndexBuffer) {
        this.layoutVertexBuffer = new VertexBuffer(gl, this.layoutVertexArray);
        this.indexBuffer = new IndexBuffer(gl, this.indexArray, dynamicIndexBuffer);
        this.programConfigurations.upload(gl);

        if (this.programInterface.dynamicLayoutAttributes) {
            this.dynamicLayoutVertexBuffer = new VertexBuffer(gl, this.dynamicLayoutVertexArray, true);
        }
        if (this.programInterface.opacityAttributes) {
            this.opacityVertexBuffer = new VertexBuffer(gl, this.opacityVertexArray, true);
            // This is a performance hack so that we can write to opacityVertexArray with uint32s
            // even though the shaders read uint8s
            this.opacityVertexBuffer.itemSize = 1;
            this.opacityVertexBuffer.attributes = shaderOpacityAttributes;
        }
        if (this.programInterface.collisionAttributes) {
            this.collisionVertexBuffer = new VertexBuffer(gl, this.collisionVertexArray, true);
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
        if (this.opacityVertexBuffer) {
            this.opacityVertexBuffer.destroy();
        }
        if (this.collisionVertexBuffer) {
            this.collisionVertexBuffer.destroy();
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
 *    have been received, the WorkerTile creates a CollisionIndex and invokes:
 *
 * 3. performSymbolLayout(bucket, stacks, icons) perform texts shaping and
 *    layout on a Symbol Bucket. This step populates:
 *      `this.symbolInstances`: metadata on generated symbols
 *      `this.collisionBoxArray`: collision data for use by foreground
 *      `this.text`: SymbolBuffers for text symbols
 *      `this.icons`: SymbolBuffers for icons
 *      `this.collisionBox`: Debug SymbolBuffers for collision boxes
 *      `this.collisionCircle`: Debug SymbolBuffers for collision circles
 *    The results are sent to the foreground for rendering
 *
 * 4. performSymbolPlacement(bucket, collisionIndex) is run on the foreground,
 *    and uses the CollisionIndex along with current camera settings to determine
 *    which symbols can actually show on the map. Collided symbols are hidden
 *    using a dynamic "OpacityVertexArray".
 *
 * @private
 */
class SymbolBucket implements Bucket {
    static programInterfaces: {
        text: ProgramInterface,
        icon: ProgramInterface,
        collisionBox: ProgramInterface,
        collisionCircle: ProgramInterface
    };

    static MAX_GLYPHS: number;
    static addDynamicAttributes: typeof addDynamicAttributes;

    collisionBoxArray: CollisionBoxArray;
    zoom: number;
    overscaling: number;
    layers: Array<SymbolStyleLayer>;
    index: number;
    sdfIcons: boolean;
    iconsNeedLinear: boolean;

    // The symbol layout process needs `text-size` evaluated at up to five different zoom levels, and
    // `icon-size` at up to three:
    //
    //   1. `text-size` at the zoom level of the bucket. Used to calculate a per-feature size for source `text-size`
    //       expressions, and to calculate the box dimensions for icon-text-fit.
    //   2. `icon-size` at the zoom level of the bucket. Used to calculate a per-feature size for source `icon-size`
    //       expressions.
    //   3. `text-size` and `icon-size` at the zoom level of the bucket, plus one. Used to calculate collision boxes.
    //   4. `text-size` at zoom level 18. Used for something line-symbol-placement-related.
    //   5.  For composite `*-size` expressions: two zoom levels of curve stops that "cover" the zoom level of the
    //       bucket. These go into a vertex buffer and are used by the shader to interpolate the size at render time.
    //
    // (1) and (2) are stored in `this.layers[0].layout`. The remainder are below.
    //
    textSizeData: SizeData;
    iconSizeData: SizeData;
    layoutTextSize: PossiblyEvaluatedPropertyValue<number>; // (3)
    layoutIconSize: PossiblyEvaluatedPropertyValue<number>; // (3)
    textMaxSize: PossiblyEvaluatedPropertyValue<number>;    // (4)
    compositeTextSizes: [PossiblyEvaluatedPropertyValue<number>, PossiblyEvaluatedPropertyValue<number>]; // (5)
    compositeIconSizes: [PossiblyEvaluatedPropertyValue<number>, PossiblyEvaluatedPropertyValue<number>]; // (5)

    placedGlyphArray: StructArray;
    placedIconArray: StructArray;
    glyphOffsetArray: StructArray;
    lineVertexArray: StructArray;
    features: Array<SymbolFeature>;
    symbolInstances: Array<SymbolInstance>;
    pixelRatio: number;
    tilePixelRatio: number;
    compareText: {[string]: Array<Point>};
    fadeStartTime: number;
    sortFeaturesByY: boolean;
    sortedAngle: number;

    text: SymbolBuffers;
    icon: SymbolBuffers;
    collisionBox: SymbolBuffers;
    uploaded: boolean;
    collisionCircle: SymbolBuffers;

    constructor(options: any) {
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
            this.collisionCircle = new SymbolBuffers(symbolInterfaces.collisionCircle, options.layers, options.zoom, options.collisionCircle);

            this.textSizeData = options.textSizeData;
            this.iconSizeData = options.iconSizeData;

            this.placedGlyphArray = new PlacedSymbolArray(options.placedGlyphArray);
            this.placedIconArray = new PlacedSymbolArray(options.placedIconArray);
            this.glyphOffsetArray = new GlyphOffsetArray(options.glyphOffsetArray);
            this.lineVertexArray = new LineVertexArray(options.lineVertexArray);

            this.symbolInstances = options.symbolInstances;

            const layout = options.layers[0].layout;
            this.sortFeaturesByY = layout.get('text-allow-overlap') || layout.get('icon-allow-overlap') ||
                layout.get('text-ignore-placement') || layout.get('icon-ignore-placement');

        } else {
            const layer: SymbolStyleLayer = this.layers[0];
            const unevaluatedLayoutValues = layer._unevaluatedLayout._values;

            this.textSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['text-size']);
            if (this.textSizeData.functionType === 'composite') {
                const {min, max} = this.textSizeData.zoomRange;
                this.compositeTextSizes = [
                    unevaluatedLayoutValues['text-size'].possiblyEvaluate({zoom: min}),
                    unevaluatedLayoutValues['text-size'].possiblyEvaluate({zoom: max})
                ];
            }

            this.iconSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['icon-size']);
            if (this.iconSizeData.functionType === 'composite') {
                const {min, max} = this.iconSizeData.zoomRange;
                this.compositeIconSizes = [
                    unevaluatedLayoutValues['icon-size'].possiblyEvaluate({zoom: min}),
                    unevaluatedLayoutValues['icon-size'].possiblyEvaluate({zoom: max})
                ];
            }

            this.layoutTextSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate({zoom: this.zoom + 1});
            this.layoutIconSize = unevaluatedLayoutValues['icon-size'].possiblyEvaluate({zoom: this.zoom + 1});
            this.textMaxSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate({zoom: 18});
        }
    }

    createArrays() {
        this.text = new SymbolBuffers(symbolInterfaces.text, this.layers, this.zoom);
        this.icon = new SymbolBuffers(symbolInterfaces.icon, this.layers, this.zoom);
        this.collisionBox = new SymbolBuffers(symbolInterfaces.collisionBox, this.layers, this.zoom);
        this.collisionCircle = new SymbolBuffers(symbolInterfaces.collisionCircle, this.layers, this.zoom);

        this.placedGlyphArray = new PlacedSymbolArray();
        this.placedIconArray = new PlacedSymbolArray();
        this.glyphOffsetArray = new GlyphOffsetArray();
        this.lineVertexArray = new LineVertexArray();
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters) {
        const layer = this.layers[0];
        const layout = layer.layout;

        const textFont = layout.get('text-font').join(',');
        const textField = layout.get('text-field');
        const iconImage = layout.get('icon-image');
        const hasText = textField.value.kind !== 'constant' || textField.value.value.length > 0 && textFont.length > 0;
        const hasIcon = iconImage.value.kind !== 'constant' || iconImage.value.value && iconImage.value.value.length > 0;

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
                text = layer.getValueAndResolveTokens('text-field', feature);
                text = transformText(text, layer, feature);
            }

            let icon;
            if (hasIcon) {
                icon = layer.getValueAndResolveTokens('icon-image', feature);
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
                const textAlongLine = layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') === 'line';
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

        if (layout.get('symbol-placement') === 'line') {
            // Merge adjacent lines with the same text to improve labelling.
            // It's better to place labels on one long line than on many short segments.
            this.features = mergeLines(this.features);
        }
    }


    isEmpty() {
        return this.symbolInstances.length === 0;
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
            collisionBox: this.collisionBox.serialize(transferables),
            collisionCircle: this.collisionCircle.serialize(transferables),
            symbolInstances: this.symbolInstances
        };
    }

    upload(gl: WebGLRenderingContext) {
        this.text.upload(gl, this.sortFeaturesByY);
        this.icon.upload(gl, this.sortFeaturesByY);
        this.collisionBox.upload(gl);
        this.collisionCircle.upload(gl);
    }

    destroy() {
        this.text.destroy();
        this.icon.destroy();
        this.collisionBox.destroy();
        this.collisionCircle.destroy();
    }

    addToLineVertexArray(anchor: Anchor, line: any) {
        const lineStartIndex = this.lineVertexArray.length;
        if (anchor.segment !== undefined) {
            let sumForwardLength = anchor.dist(line[anchor.segment + 1]);
            let sumBackwardLength = anchor.dist(line[anchor.segment]);
            const vertices = {};
            for (let i = anchor.segment + 1; i < line.length; i++) {
                vertices[i] = { x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumForwardLength };
                if (i < line.length - 1) {
                    sumForwardLength += line[i + 1].dist(line[i]);
                }
            }
            for (let i = anchor.segment || 0; i >= 0; i--) {
                vertices[i] = { x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumBackwardLength };
                if (i > 0) {
                    sumBackwardLength += line[i - 1].dist(line[i]);
                }
            }
            for (let i = 0; i < line.length; i++) {
                const vertex = vertices[i];
                this.lineVertexArray.emplaceBack(vertex.x, vertex.y, vertex.tileUnitDistanceFromAnchor);
            }
        }
        return {
            lineStartIndex: lineStartIndex,
            lineLength: this.lineVertexArray.length - lineStartIndex
        };
    }

    addSymbols(arrays: SymbolBuffers,
               quads: Array<SymbolQuad>,
               sizeVertex: any,
               lineOffset: [number, number],
               alongLine: boolean,
               feature: ExpressionFeature,
               writingMode: any,
               labelAnchor: Anchor,
               lineStartIndex: number,
               lineLength: number,
               placedSymbolArray: StructArray) {
        const indexArray = arrays.indexArray;
        const layoutVertexArray = arrays.layoutVertexArray;
        const dynamicLayoutVertexArray = arrays.dynamicLayoutVertexArray;

        const segment = arrays.segments.prepareSegment(4 * quads.length, arrays.layoutVertexArray, arrays.indexArray);
        const glyphOffsetArrayStart = this.glyphOffsetArray.length;
        const vertexStartIndex = segment.vertexLength;

        for (const symbol of quads) {

            const tl = symbol.tl,
                tr = symbol.tr,
                bl = symbol.bl,
                br = symbol.br,
                tex = symbol.tex;

            const index = segment.vertexLength;

            const y = symbol.glyphOffset[1];
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tl.x, y + tl.y, tex.x, tex.y, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tr.x, y + tr.y, tex.x + tex.w, tex.y, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, bl.x, y + bl.y, tex.x, tex.y + tex.h, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, br.x, y + br.y, tex.x + tex.w, tex.y + tex.h, sizeVertex);

            addDynamicAttributes(dynamicLayoutVertexArray, labelAnchor, 0);

            indexArray.emplaceBack(index, index + 1, index + 2);
            indexArray.emplaceBack(index + 1, index + 2, index + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;

            this.glyphOffsetArray.emplaceBack(symbol.glyphOffset[0]);
        }

        placedSymbolArray.emplaceBack(labelAnchor.x, labelAnchor.y,
            glyphOffsetArrayStart, this.glyphOffsetArray.length - glyphOffsetArrayStart, vertexStartIndex,
            lineStartIndex, lineLength, labelAnchor.segment,
            sizeVertex ? sizeVertex[0] : 0, sizeVertex ? sizeVertex[1] : 0,
            lineOffset[0], lineOffset[1],
            writingMode, false);

        arrays.programConfigurations.populatePaintArrays(arrays.layoutVertexArray.length, feature);
    }

    _addCollisionDebugVertex(layoutVertexArray: StructArray, collisionVertexArray: StructArray, point: Point, anchor: Point, extrude: Point) {
        collisionVertexArray.emplaceBack(0, 0);
        return layoutVertexArray.emplaceBack(
            // pos
            point.x,
            point.y,
            // a_anchor_pos
            anchor.x,
            anchor.y,
            // extrude
            Math.round(extrude.x),
            Math.round(extrude.y));
    }


    addCollisionDebugVertices(x1: number, y1: number, x2: number, y2: number, arrays: SymbolBuffers, boxAnchorPoint: Point, symbolInstance: SymbolInstance, isCircle: boolean) {
        const segment = arrays.segments.prepareSegment(4, arrays.layoutVertexArray, arrays.indexArray);
        const index = segment.vertexLength;

        const layoutVertexArray = arrays.layoutVertexArray;
        const indexArray = arrays.indexArray;
        const collisionVertexArray = arrays.collisionVertexArray;

        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x1, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x2, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x2, y2));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x1, y2));

        segment.vertexLength += 4;
        if (isCircle) {
            indexArray.emplaceBack(index, index + 1, index + 2);
            indexArray.emplaceBack(index, index + 2, index + 3);

            segment.primitiveLength += 2;
        } else {
            indexArray.emplaceBack(index, index + 1);
            indexArray.emplaceBack(index + 1, index + 2);
            indexArray.emplaceBack(index + 2, index + 3);
            indexArray.emplaceBack(index + 3, index);

            segment.primitiveLength += 4;
        }
    }

    generateCollisionDebugBuffers() {
        for (const symbolInstance of this.symbolInstances) {
            symbolInstance.textCollisionFeature = {boxStartIndex: symbolInstance.textBoxStartIndex, boxEndIndex: symbolInstance.textBoxEndIndex};
            symbolInstance.iconCollisionFeature = {boxStartIndex: symbolInstance.iconBoxStartIndex, boxEndIndex: symbolInstance.iconBoxEndIndex};

            for (let i = 0; i < 2; i++) {
                const feature = symbolInstance[i === 0 ? 'textCollisionFeature' : 'iconCollisionFeature'];
                if (!feature) continue;

                for (let b = feature.boxStartIndex; b < feature.boxEndIndex; b++) {
                    const box: CollisionBox = (this.collisionBoxArray.get(b): any);
                    const x1 = box.x1;
                    const y1 = box.y1;
                    const x2 = box.x2;
                    const y2 = box.y2;

                    // If the radius > 0, this collision box is actually a circle
                    // The data we add to the buffers is exactly the same, but we'll render with a different shader.
                    const isCircle = box.radius > 0;
                    this.addCollisionDebugVertices(x1, y1, x2, y2, isCircle ? this.collisionCircle : this.collisionBox, box.anchorPoint, symbolInstance, isCircle);
                }
            }
        }
    }

    // These flat arrays are meant to be quicker to iterate over than the source
    // CollisionBoxArray
    deserializeCollisionBoxes(collisionBoxArray: CollisionBoxArray, textStartIndex: number, textEndIndex: number, iconStartIndex: number, iconEndIndex: number): CollisionArrays {
        const collisionArrays = {};
        for (let k = textStartIndex; k < textEndIndex; k++) {
            const box: CollisionBox = (collisionBoxArray.get(k): any);
            if (box.radius === 0) {
                collisionArrays.textBox = { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY };

                break; // Only one box allowed per instance
            } else {
                if (!collisionArrays.textCircles) {
                    collisionArrays.textCircles = [];
                }
                const used = 1; // May be updated at collision detection time
                collisionArrays.textCircles.push(box.anchorPointX, box.anchorPointY, box.radius, box.signedDistanceFromAnchor, used);
            }
        }
        for (let k = iconStartIndex; k < iconEndIndex; k++) {
            // An icon can only have one box now, so this indexing is a bit vestigial...
            const box: CollisionBox = (collisionBoxArray.get(k): any);
            if (box.radius === 0) {
                collisionArrays.iconBox = { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2, anchorPointX: box.anchorPointX, anchorPointY: box.anchorPointY };
                break; // Only one box allowed per instance
            }
        }
        return collisionArrays;
    }

    sortFeatures(angle: number) {
        if (!this.sortFeaturesByY) return;

        if (this.sortedAngle === angle) return;
        this.sortedAngle = angle;

        // The current approach to sorting doesn't sort across segments so don't try.
        // Sorting within segments separately seemed not to be worth the complexity.
        if (this.text.segments.get().length > 1 || this.icon.segments.get().length > 1) return;

        // If the symbols are allowed to overlap sort them by their vertical screen position.
        // The index array buffer is rewritten to reference the (unchanged) vertices in the
        // sorted order.

        // To avoid sorting the actual symbolInstance array we sort an array of indexes.
        const symbolInstanceIndexes = [];
        for (let i = 0; i < this.symbolInstances.length; i++) {
            symbolInstanceIndexes.push(i);
        }

        const sin = Math.sin(angle),
            cos = Math.cos(angle);

        symbolInstanceIndexes.sort((aIndex, bIndex) => {
            const a = this.symbolInstances[aIndex];
            const b = this.symbolInstances[bIndex];
            const aRotated = (sin * a.anchor.x + cos * a.anchor.y) | 0;
            const bRotated = (sin * b.anchor.x + cos * b.anchor.y) | 0;
            return (aRotated - bRotated) || (b.featureIndex - a.featureIndex);
        });

        this.text.indexArray.clear();
        this.icon.indexArray.clear();

        for (const i of symbolInstanceIndexes) {
            const symbolInstance = this.symbolInstances[i];

            for (const placedTextSymbolIndex of symbolInstance.placedTextSymbolIndices) {
                const placedSymbol = (this.placedGlyphArray.get(placedTextSymbolIndex): any);

                const endIndex = placedSymbol.vertexStartIndex + placedSymbol.numGlyphs * 4;
                for (let vertexIndex = placedSymbol.vertexStartIndex; vertexIndex < endIndex; vertexIndex += 4) {
                    this.text.indexArray.emplaceBack(vertexIndex, vertexIndex + 1, vertexIndex + 2);
                    this.text.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
                }
            }

            const placedIcon = (this.placedIconArray.get(i): any);
            if (placedIcon.numGlyphs) {
                const vertexIndex = placedIcon.vertexStartIndex;
                this.icon.indexArray.emplaceBack(vertexIndex, vertexIndex + 1, vertexIndex + 2);
                this.icon.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
            }
        }

        if (this.text.indexBuffer) this.text.indexBuffer.updateData(this.text.indexArray.serialize());
        if (this.icon.indexBuffer) this.icon.indexBuffer.updateData(this.icon.indexArray.serialize());
    }
}

SymbolBucket.programInterfaces = symbolInterfaces;

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, glyphOffsetArrayStart
// eg the max valid UInt16 is 65,535
// See https://github.com/mapbox/mapbox-gl-js/issues/2907 for motivation
// lineStartIndex and textBoxStartIndex could potentially be concerns
// but we expect there to be many fewer boxes/lines than glyphs
SymbolBucket.MAX_GLYPHS = 65535;

SymbolBucket.addDynamicAttributes = addDynamicAttributes;

module.exports = SymbolBucket;
