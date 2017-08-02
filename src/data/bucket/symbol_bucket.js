// @flow
const Point = require('point-geometry');
const ArrayGroup = require('../array_group');
const BufferGroup = require('../buffer_group');
const createElementArrayType = require('../element_array_type');
const packUint8ToFloat = require('../../shaders/encode_attribute').packUint8ToFloat;
const resolveTokens = require('../../util/token');
const transformText = require('../../symbol/transform_text');
const mergeLines = require('../../symbol/mergelines');
const util = require('../../util/util');
const scriptDetection = require('../../util/script_detection');
const loadGeometry = require('../load_geometry');
const vectorTileFeatureTypes = require('vector-tile').VectorTileFeature.types;
const createStructArrayType = require('../../util/struct_array');
const verticalizePunctuation = require('../../util/verticalize_punctuation');

import type {BucketParameters, PopulateParameters} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type {IndexedFeature} from '../feature_index';

type SymbolBucketParameters = BucketParameters & {
    sdfIcons: boolean,
    iconsNeedLinear: boolean,
    fontstack: any,
    textSizeData: any,
    iconSizeData: any,
    placedGlyphArray: any,
    placedIconArray: any,
    glyphOffsetArray: any,
    lineVertexArray: any,
}

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
        { type: 'Int16', name: 'y' },
        { type: 'Int16', name: 'tileUnitDistanceFromAnchor' }
    ]});

const elementArrayType = createElementArrayType();

const layoutAttributes = [
    {name: 'a_pos_offset',  components: 4, type: 'Int16'},
    {name: 'a_data',        components: 4, type: 'Uint16'}
];

const dynamicLayoutAttributes = [
    { name: 'a_projected_pos', components: 3, type: 'Float32' }
];

const opacityAttributes = [
    { name: 'a_fade_opacity', components: 2, type: 'Uint16' }
];

const collisionAttributes = [
    { name: 'a_placed', components: 2, type: 'Uint8' }
];

const symbolInterfaces = {
    glyph: {
        layoutAttributes: layoutAttributes,
        dynamicLayoutAttributes: dynamicLayoutAttributes,
        opacityAttributes: opacityAttributes,
        elementArrayType: elementArrayType,
        paintAttributes: [
            {name: 'a_fill_color', property: 'text-color', type: 'Uint8'},
            {name: 'a_halo_color', property: 'text-halo-color', type: 'Uint8'},
            {name: 'a_halo_width', property: 'text-halo-width', type: 'Uint16', multiplier: 10},
            {name: 'a_halo_blur', property: 'text-halo-blur', type: 'Uint16', multiplier: 10},
            {name: 'a_opacity', property: 'text-opacity', type: 'Uint8', multiplier: 255}
        ]
    },
    icon: {
        layoutAttributes: layoutAttributes,
        dynamicLayoutAttributes: dynamicLayoutAttributes,
        opacityAttributes: opacityAttributes,
        elementArrayType: elementArrayType,
        paintAttributes: [
            {name: 'a_fill_color', property: 'icon-color', type: 'Uint8'},
            {name: 'a_halo_color', property: 'icon-halo-color', type: 'Uint8'},
            {name: 'a_halo_width', property: 'icon-halo-width', type: 'Uint16', multiplier: 10},
            {name: 'a_halo_blur', property: 'icon-halo-blur', type: 'Uint16', multiplier: 10},
            {name: 'a_opacity', property: 'icon-opacity', type: 'Uint8', multiplier: 255}
        ]
    },
    collisionBox: { // used to render collision boxes for debugging purposes
        layoutAttributes: [
            {name: 'a_pos',        components: 2, type: 'Int16'},
            {name: 'a_anchor_pos', components: 2, type: 'Int16'},
            {name: 'a_extrude',    components: 2, type: 'Int16'}
        ],
        collisionAttributes: collisionAttributes,
        elementArrayType: createElementArrayType(2)
    },
    collisionCircle: { // used to render collision circles for debugging purposes
        layoutAttributes: [
            {name: 'a_pos',        components: 2, type: 'Int16'},
            {name: 'a_anchor_pos', components: 2, type: 'Int16'},
            {name: 'a_extrude',    components: 2, type: 'Int16'}
        ],
        collisionAttributes: collisionAttributes,
        elementArrayType: createElementArrayType(3)
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
 * 3. SymbolBucket#prepare(stacks, icons) to perform text shaping and layout, populating `this.symbolInstances` and `this.collisionBoxArray`.
 *
 * 4. SymbolBucket#place(collisionTile): taking collisions into account, decide on which labels and icons to actually draw and at which scale, populating the vertex arrays (`this.arrays.glyph`, `this.arrays.icon`) and thus completing the parsing / buffer population process.
 *
 * The reason that `prepare` and `place` are separate methods is that
 * `prepare`, being independent of pitch and orientation, only needs to happen
 * at tile load time, whereas `place` must be invoked on already-loaded tiles
 * when the pitch/orientation are changed. (See `redoPlacement`.)
 *
 * @private
 */
class SymbolBucket {
    static programInterfaces: {
        glyph: ProgramInterface,
        icon: ProgramInterface,
        collisionBox: ProgramInterface,
        collisionCircle: ProgramInterface
    };

    static MAX_INSTANCES: number;

    static addDynamicAttributes: any;

    collisionBoxArray: any;
    zoom: number;
    overscaling: number;
    layers: any;
    index: any;
    sdfIcons: boolean;
    iconsNeedLinear: boolean;
    fontstack: any;
    symbolInterfaces: any;
    buffers: any;
    textSizeData: any;
    iconSizeData: any;
    placedGlyphArray: any;
    placedIconArray: any;
    glyphOffsetArray: any;
    lineVertexArray: any;
    features: any;
    arrays: any;
    symbolInstances: any;
    tilePixelRatio: any;
    compareText: any;

    constructor(options: SymbolBucketParameters) {
        this.collisionBoxArray = options.collisionBoxArray;

        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;
        this.sdfIcons = options.sdfIcons;
        this.iconsNeedLinear = options.iconsNeedLinear;
        this.fontstack = options.fontstack;

        // Set up 'program interfaces' dynamically based on the layer's style
        // properties (specifically its text-size properties).
        const layer = this.layers[0];
        this.symbolInterfaces = symbolInterfaces;

        // deserializing a bucket created on a worker thread
        if (options.symbolInstances) {
            this.buffers = {};
            for (const id in options.arrays) {
                if (options.arrays[id]) {
                    this.buffers[id] = new BufferGroup(this.symbolInterfaces[id], options.layers, options.zoom, options.arrays[id]);
                }
            }
            this.textSizeData = options.textSizeData;
            this.iconSizeData = options.iconSizeData;

            this.placedGlyphArray = new PlacedSymbolArray(options.placedGlyphArray);
            this.placedIconArray = new PlacedSymbolArray(options.placedIconArray);
            this.glyphOffsetArray = new GlyphOffsetArray(options.glyphOffsetArray);
            this.lineVertexArray = new LineVertexArray(options.lineVertexArray);

            this.symbolInstances = options.symbolInstances;

        } else {
            this.textSizeData = getSizeData(this.zoom, layer, 'text-size');
            this.iconSizeData = getSizeData(this.zoom, layer, 'icon-size');
        }
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters) {
        const layer = this.layers[0];
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

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            if (!layer.filter(feature)) {
                continue;
            }

            let text;
            if (hasText) {
                text = layer.getLayoutValue('text-field', globalProperties, feature.properties);
                if (layer.isLayoutValueFeatureConstant('text-field')) {
                    text = resolveTokens(feature.properties, text);
                }
                text = transformText(text, layer, globalProperties, feature.properties);
            }

            let icon;
            if (hasIcon) {
                icon = layer.getLayoutValue('icon-image', globalProperties, feature.properties);
                if (layer.isLayoutValueFeatureConstant('icon-image')) {
                    icon = resolveTokens(feature.properties, icon);
                }
            }

            if (!text && !icon) {
                continue;
            }

            this.features.push({
                text,
                icon,
                index: i,
                sourceLayerIndex: feature.sourceLayerIndex,
                geometry: loadGeometry(feature),
                properties: feature.properties,
                type: vectorTileFeatureTypes[feature.type]
            });

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
        return this.symbolInstances.length === 0;
    }

    getPaintPropertyStatistics() {
        const statistics = {};
        if (this.arrays) {
            for (const layer of this.layers) {
                statistics[layer.id] = util.extend({},
                    this.arrays.icon.layerData[layer.id].paintPropertyStatistics,
                    this.arrays.glyph.layerData[layer.id].paintPropertyStatistics
                );
            }
        }
        return statistics;
    }

    serialize(transferables?: Array<Transferable>) {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            sdfIcons: this.sdfIcons,
            iconsNeedLinear: this.iconsNeedLinear,
            textSizeData: this.textSizeData,
            iconSizeData: this.iconSizeData,
            fontstack: this.fontstack,
            placedGlyphArray: this.placedGlyphArray.serialize(transferables),
            placedIconArray: this.placedIconArray.serialize(transferables),
            glyphOffsetArray: this.glyphOffsetArray.serialize(transferables),
            lineVertexArray: this.lineVertexArray.serialize(transferables),
            arrays: util.mapObject(this.arrays, (a) => a.isEmpty() ? null : a.serialize(transferables)),
            symbolInstances: this.symbolInstances
        };
    }

    destroy() {
        if (this.buffers) {
            if (this.buffers.icon) this.buffers.icon.destroy();
            if (this.buffers.glyph) this.buffers.glyph.destroy();
            if (this.buffers.collisionBox) this.buffers.collisionBox.destroy();
            if (this.buffers.collisionCircle) this.buffers.collisionCircle.destroy();
            this.buffers = null;
        }
    }

    createArrays() {
        this.arrays = util.mapObject(this.symbolInterfaces, (programInterface) => {
            return new ArrayGroup(programInterface, this.layers, this.zoom);
        });
        this.placedGlyphArray = new PlacedSymbolArray();
        this.placedIconArray = new PlacedSymbolArray();
        this.glyphOffsetArray = new GlyphOffsetArray();
        this.lineVertexArray = new LineVertexArray();
    }

    addSymbols(arrays: any, quads: any, sizeVertex: any, lineOffset: any, alongLine: any, featureProperties: any, isVertical: any, labelAnchor: any, lineStartIndex: any, lineLength: any, placedSymbolArray: any) {
        const elementArray = arrays.elementArray;
        const layoutVertexArray = arrays.layoutVertexArray;
        const dynamicLayoutVertexArray = arrays.dynamicLayoutVertexArray;

        const zoom = this.zoom;
        const placementZoom = zoom;//Math.max(Math.log(scale) / Math.LN2 + zoom, 0);

        const glyphOffsetArrayStart = this.glyphOffsetArray.length;

        for (const symbol of quads) {

            const tl = symbol.tl,
                tr = symbol.tr,
                bl = symbol.bl,
                br = symbol.br,
                tex = symbol.tex;

            const segment = arrays.prepareSegment(4);
            const index = segment.vertexLength;

            const y = symbol.glyphOffset[1];
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tl.x, y + tl.y, tex.x, tex.y, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tr.x, y + tr.y, tex.x + tex.w, tex.y, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, bl.x, y + bl.y, tex.x, tex.y + tex.h, sizeVertex);
            addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, br.x, y + br.y, tex.x + tex.w, tex.y + tex.h, sizeVertex);

            addDynamicAttributes(dynamicLayoutVertexArray, labelAnchor, 0, placementZoom);
            arrays.opacityVertexArray.emplaceBack(0);
            arrays.opacityVertexArray.emplaceBack(0);
            arrays.opacityVertexArray.emplaceBack(0);
            arrays.opacityVertexArray.emplaceBack(0);

            elementArray.emplaceBack(index, index + 1, index + 2);
            elementArray.emplaceBack(index + 1, index + 2, index + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;

            this.glyphOffsetArray.emplaceBack(symbol.glyphOffset[0]);
        }

        placedSymbolArray.emplaceBack(labelAnchor.x, labelAnchor.y,
            glyphOffsetArrayStart, this.glyphOffsetArray.length - glyphOffsetArrayStart,
            lineStartIndex, lineLength, labelAnchor.segment,
            sizeVertex ? sizeVertex[0] : 0, sizeVertex ? sizeVertex[1] : 0,
            lineOffset[0], lineOffset[1],
            placementZoom, isVertical);

        arrays.populatePaintArrays(featureProperties);
    }

    _addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, point, anchor, extrude) {
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


    addCollisionDebugVertices(x1, y1, x2, y2, bucketArrays, boxAnchorPoint, symbolInstance, isCircle) {
        const arrays = isCircle ? bucketArrays.collisionCircle : bucketArrays.collisionBox;

        const segment = arrays.prepareSegment(4);
        const index = segment.vertexLength;

        const layoutVertexArray = arrays.layoutVertexArray;
        const elementArray = arrays.elementArray;
        const collisionVertexArray = arrays.collisionVertexArray;

        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x1, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x2, y1));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x2, y2));
        this._addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x1, y2));

        segment.vertexLength += 4;
        if (isCircle) {
            elementArray.emplaceBack(index, index + 1, index + 2);
            elementArray.emplaceBack(index, index + 2, index + 3);

            segment.primitiveLength += 2;
        } else {
            elementArray.emplaceBack(index, index + 1);
            elementArray.emplaceBack(index + 1, index + 2);
            elementArray.emplaceBack(index + 2, index + 3);
            elementArray.emplaceBack(index + 3, index);

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
                    const box = this.collisionBoxArray.get(b);
                    const boxAnchorPoint = new Point(box.anchorPointX, box.anchorPointY);
                    const x1 = box.x1;
                    const y1 = box.y1;
                    const x2 = box.x2;
                    const y2 = box.y2;

                    // If the radius > 0, this collision box is actually a circle
                    // The data we add to the buffers is exactly the same, but we'll render with a different shader.
                    this.addCollisionDebugVertices(x1, y1, x2, y2, this.arrays, boxAnchorPoint, symbolInstance, box.radius > 0);
                }
            }
        }
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
            for (let i = anchor.segment; i >= 0; i--) {
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

    // These flat arrays are meant to be quicker to iterate over than the source
    // CollisionBoxArray
    deserializeCollisionBoxes(collisionBoxArray, startIndex, endIndex) {
        const boxes = [];
        for (let k = startIndex; k < endIndex; k++) {
            const box = collisionBoxArray.get(k);
            if (box.radius !== 0) {
                // This is actually an array of circles
                return [];
            }
            boxes.push(box.x1);
            boxes.push(box.y1);
            boxes.push(box.x2);
            boxes.push(box.y2);
            boxes.push(box.anchorPointX);
            boxes.push(box.anchorPointY);
        }
        return boxes;
    }

    deserializeCollisionCircles(collisionBoxArray, startIndex, endIndex) {
        const circles = [];
        for (let k = startIndex; k < endIndex; k++) {
            const circle = collisionBoxArray.get(k);
            if (circle.radius === 0) {
                // This is actually an array of boxes
                return [];
            }
            circles.push(circle.anchorPointX);
            circles.push(circle.anchorPointY);
            circles.push(circle.radius);
            circles.push(circle.distanceToAnchor);
            circles.push(false); // Last position is used to mark if the circle is actually used at render time
        }
        return circles;
    }

}

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
function getSizeData(tileZoom, layer, sizeProperty) {
    const sizeData = {};

    sizeData.isFeatureConstant = layer.isLayoutValueFeatureConstant(sizeProperty);
    sizeData.isZoomConstant = layer.isLayoutValueZoomConstant(sizeProperty);

    if (sizeData.isFeatureConstant) {
        sizeData.layoutSize = layer.getLayoutValue(sizeProperty, {zoom: tileZoom + 1});
    }

    // calculate covering zoom stops for zoom-dependent values
    if (!sizeData.isZoomConstant) {
        const levels = layer.getLayoutValueStopZoomLevels(sizeProperty);
        let lower = 0;
        while (lower < levels.length && levels[lower] <= tileZoom) lower++;
        lower = Math.max(0, lower - 1);
        let upper = lower;
        while (upper < levels.length && levels[upper] < tileZoom + 1) upper++;
        upper = Math.min(levels.length - 1, upper);

        sizeData.coveringZoomRange = [levels[lower], levels[upper]];
        if (layer.isLayoutValueFeatureConstant(sizeProperty)) {
            // for camera functions, also save off the function values
            // evaluated at the covering zoom levels
            sizeData.coveringStopValues = [
                layer.getLayoutValue(sizeProperty, {zoom: levels[lower]}),
                layer.getLayoutValue(sizeProperty, {zoom: levels[upper]})
            ];
        }

        // also store the function's base for use in calculating the
        // interpolation factor each frame
        sizeData.functionBase = layer.getLayoutProperty(sizeProperty).base;
        if (typeof sizeData.functionBase === 'undefined') {
            sizeData.functionBase = 1;
        }
        sizeData.functionType = layer.getLayoutProperty(sizeProperty).type ||
            'exponential';
    }

    return sizeData;
}

SymbolBucket.programInterfaces = symbolInterfaces;

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, iconBoxEndIndex and textBoxEndIndex
// eg the max valid UInt16 is 65,535
SymbolBucket.MAX_INSTANCES = 65535;

SymbolBucket.addDynamicAttributes = addDynamicAttributes;

module.exports = SymbolBucket;
