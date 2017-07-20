// @flow

const Point = require('point-geometry');
const ArrayGroup = require('../array_group');
const BufferGroup = require('../buffer_group');
const createElementArrayType = require('../element_array_type');
const EXTENT = require('../extent');
const packUint8ToFloat = require('../../shaders/encode_attribute').packUint8ToFloat;
const Anchor = require('../../symbol/anchor');
const getAnchors = require('../../symbol/get_anchors');
const resolveTokens = require('../../util/token');
const Quads = require('../../symbol/quads');
const Shaping = require('../../symbol/shaping');
const transformText = require('../../symbol/transform_text');
const mergeLines = require('../../symbol/mergelines');
const clipLine = require('../../symbol/clip_line');
const util = require('../../util/util');
const scriptDetection = require('../../util/script_detection');
const loadGeometry = require('../load_geometry');
const CollisionFeature = require('../../symbol/collision_feature');
const findPoleOfInaccessibility = require('../../util/find_pole_of_inaccessibility');
const classifyRings = require('../../util/classify_rings');
const vectorTileFeatureTypes = require('vector-tile').VectorTileFeature.types;
const createStructArrayType = require('../../util/struct_array');
const verticalizePunctuation = require('../../util/verticalize_punctuation');

const shapeText = Shaping.shapeText;
const shapeIcon = Shaping.shapeIcon;
const WritingMode = Shaping.WritingMode;
const getGlyphQuads = Quads.getGlyphQuads;
const getIconQuads = Quads.getIconQuads;

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
            {name: 'a_extrude',    components: 2, type: 'Int16'},
            {name: 'a_is_circle', type: 'Uint8' }
        ],
        collisionAttributes: collisionAttributes,
        elementArrayType: createElementArrayType(2)
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
        collisionBox: ProgramInterface
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
            this.buffers = null;
        }
    }

    createArrays() {
        this.arrays = util.mapObject(this.symbolInterfaces, (programInterface) => {
            return new ArrayGroup(programInterface, this.layers, this.zoom);
        });
    }

    prepare(stacks: any, icons: any, showCollisionBoxes: boolean) {
        this.symbolInstances = [];

        this.createArrays();

        this.placedGlyphArray = new PlacedSymbolArray();
        this.placedIconArray = new PlacedSymbolArray();
        this.glyphOffsetArray = new GlyphOffsetArray();
        this.lineVertexArray = new LineVertexArray();

        const tileSize = 512 * this.overscaling;
        this.tilePixelRatio = EXTENT / tileSize;
        this.compareText = {};
        this.iconsNeedLinear = false;

        const layout = this.layers[0].layout;

        let horizontalAlign = 0.5,
            verticalAlign = 0.5;

        switch (layout['text-anchor']) {
        case 'right':
        case 'top-right':
        case 'bottom-right':
            horizontalAlign = 1;
            break;
        case 'left':
        case 'top-left':
        case 'bottom-left':
            horizontalAlign = 0;
            break;
        }

        switch (layout['text-anchor']) {
        case 'bottom':
        case 'bottom-right':
        case 'bottom-left':
            verticalAlign = 1;
            break;
        case 'top':
        case 'top-right':
        case 'top-left':
            verticalAlign = 0;
            break;
        }

        const justify =
            layout['text-justify'] === 'right' ? 1 :
            layout['text-justify'] === 'left' ? 0 : 0.5;

        const oneEm = 24;
        const lineHeight = layout['text-line-height'] * oneEm;
        const maxWidth = layout['symbol-placement'] !== 'line' ? layout['text-max-width'] * oneEm : 0;
        const spacing = layout['text-letter-spacing'] * oneEm;
        const fontstack = this.fontstack = layout['text-font'].join(',');
        const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';

        for (const feature of this.features) {

            let shapedTextOrientations;
            if (feature.text) {
                const allowsVerticalWritingMode = scriptDetection.allowsVerticalWritingMode(feature.text);
                const textOffset = this.layers[0].getLayoutValue('text-offset', {zoom: this.zoom}, feature.properties).map((t)=> t * oneEm);
                const spacingIfAllowed = scriptDetection.allowsLetterSpacing(feature.text) ? spacing : 0;

                shapedTextOrientations = {
                    [WritingMode.horizontal]: shapeText(feature.text, stacks[fontstack], maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacingIfAllowed, textOffset, oneEm, WritingMode.horizontal),
                    [WritingMode.vertical]: allowsVerticalWritingMode && textAlongLine && shapeText(feature.text, stacks[fontstack], maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacingIfAllowed, textOffset, oneEm, WritingMode.vertical)
                };
            } else {
                shapedTextOrientations = {};
            }

            let shapedIcon;
            if (feature.icon) {
                const image = icons[feature.icon];
                if (image) {
                    shapedIcon = shapeIcon(image,
                        this.layers[0].getLayoutValue('icon-offset', {zoom: this.zoom}, feature.properties));
                    if (this.sdfIcons === undefined) {
                        this.sdfIcons = image.sdf;
                    } else if (this.sdfIcons !== image.sdf) {
                        util.warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                    }
                    if (!image.isNativePixelRatio) {
                        this.iconsNeedLinear = true;
                    } else if (layout['icon-rotate'] !== 0 || !this.layers[0].isLayoutValueFeatureConstant('icon-rotate')) {
                        this.iconsNeedLinear = true;
                    }
                }
            }

            if (shapedTextOrientations[WritingMode.horizontal] || shapedIcon) {
                this.addFeature(feature, shapedTextOrientations, shapedIcon);
            }
        }

        // TODO: Only do this if showCollisionBoxes is set, but also make sure to reload tiles when the value
        // changes since we don't generate buffers on placement anymore.
        this.generateCollisionDebugBuffers();
    }

    /**
     * Given a feature and its shaped text and icon data, add a 'symbol
     * instance' for each _possible_ placement of the symbol feature.
     * (SymbolBucket#place() selects which of these instances to send to the
     * renderer based on collisions with symbols in other layers from the same
     * source.)
     * @private
     */
    addFeature(feature: any, shapedTextOrientations: any, shapedIcon: any) {
        const layoutTextSize = this.layers[0].getLayoutValue('text-size', {zoom: this.zoom + 1}, feature.properties);
        const layoutIconSize = this.layers[0].getLayoutValue('icon-size', {zoom: this.zoom + 1}, feature.properties);

        const textOffset = this.layers[0].getLayoutValue('text-offset', {zoom: this.zoom }, feature.properties);
        const iconOffset = this.layers[0].getLayoutValue('icon-offset', {zoom: this.zoom }, feature.properties);

        // To reduce the number of labels that jump around when zooming we need
        // to use a text-size value that is the same for all zoom levels.
        // This calculates text-size at a high zoom level so that all tiles can
        // use the same value when calculating anchor positions.
        let textMaxSize = this.layers[0].getLayoutValue('text-size', {zoom: 18}, feature.properties);
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

            if (!inside) return;

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
                {zoom: this.zoom}, feature.properties);
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

    anchorIsTooClose(text: any, repeatDistance: any, anchor: any) {
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

    _addCollisionBoxVertex(layoutVertexArray, collisionVertexArray, point, anchor, extrude, isCircle) {
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
            Math.round(extrude.y),
            // a_is_circle
            isCircle ? 1 : 0);
    }


    addCollisionBoxVertices(x1, y1, x2, y2, layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance, arrays, elementArray, isCircle) {
        const segment = arrays.prepareSegment(4);
        const index = segment.vertexLength;

        this._addCollisionBoxVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x1, y1), isCircle);
        this._addCollisionBoxVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x2, y1), isCircle);
        this._addCollisionBoxVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x2, y2), isCircle);
        this._addCollisionBoxVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance.anchor, new Point(x1, y2), isCircle);

        elementArray.emplaceBack(index, index + 1);
        elementArray.emplaceBack(index + 1, index + 2);
        elementArray.emplaceBack(index + 2, index + 3);
        elementArray.emplaceBack(index + 3, index);

        segment.vertexLength += 4;
        segment.primitiveLength += 4;
    }

    generateCollisionDebugBuffers() {
        const arrays = this.arrays.collisionBox;
        const layoutVertexArray = arrays.layoutVertexArray;
        const elementArray = arrays.elementArray;
        const collisionVertexArray = arrays.collisionVertexArray;

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

                    // TODO: The collision debug view can't draw circles yet, so we just draw the box that contains the circle
                    this.addCollisionBoxVertices(x1, y1, x2, y2, layoutVertexArray, collisionVertexArray, boxAnchorPoint, symbolInstance, arrays, elementArray, false);
                }
            }
        }
    }

    _addToLineVertexArray(anchor: Anchor, line: any) {
        const lineStartIndex = this.lineVertexArray.length;
        if (anchor.segment === undefined) {
            // TODO: Horizontal label, I think we just need to add this to keep the arrays in sync but not sure what this is for....
            for (let i = 0; i < line.length; i++) {
                this.lineVertexArray.emplaceBack(line[i].x, line[i].y, 0);
            }
        } else {
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
    addSymbolInstance(anchor: any, line: any, shapedTextOrientations: any, shapedIcon: any, layer: any, addToBuffers: any, collisionBoxArray: any, featureIndex: any, sourceLayerIndex: any, bucketIndex: any,
        textBoxScale: any, textPadding: any, textAlongLine: any, textOffset: any,
        iconBoxScale: any, iconPadding: any, iconAlongLine: any, iconOffset: any, globalProperties: any, featureProperties: any) {

        const lineArray = this._addToLineVertexArray(anchor, line);

        let textCollisionFeature, iconCollisionFeature;
        let placedTextSymbolIndex;
        let iconQuads = [];
        let glyphQuads = [];

        let numIconVertices = 0;
        let numGlyphVertices = 0;
        let numVerticalGlyphVertices = 0;
        let key = '';
        for (const writingModeString in shapedTextOrientations) {
            const writingMode = parseInt(writingModeString, 10);
            if (!shapedTextOrientations[writingMode]) continue;
            key = shapedTextOrientations[writingMode].text;
            glyphQuads = addToBuffers ?
                getGlyphQuads(anchor, shapedTextOrientations[writingMode],
                    layer, textAlongLine, globalProperties, featureProperties) :
                [];
            textCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedTextOrientations[writingMode], textBoxScale, textPadding, textAlongLine, false, key);

            if (writingMode === WritingMode.vertical) {
                numVerticalGlyphVertices = glyphQuads.length * 4;
            } else {
                numGlyphVertices = glyphQuads.length * 4;
            }

            const textSizeData = getSizeVertexData(layer,
                this.zoom,
                this.textSizeData.coveringZoomRange,
                'text-size',
                featureProperties);
            this.addSymbols(
                this.arrays.glyph,
                glyphQuads,
                textSizeData,
                textOffset,
                textAlongLine,
                featureProperties,
                writingMode === WritingMode.vertical,
                anchor,
                lineArray.lineStartIndex,
                lineArray.lineLength,
                this.placedGlyphArray);
            placedTextSymbolIndex = this.placedGlyphArray.length - 1; // TODO: Make this work for vertical
        }

        const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : this.collisionBoxArray.length;
        const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : this.collisionBoxArray.length;

        if (shapedIcon) {
            iconQuads = addToBuffers ?
                getIconQuads(anchor, shapedIcon, layer,
                    iconAlongLine, shapedTextOrientations[WritingMode.horizontal],
                    globalProperties, featureProperties) :
                [];
            iconCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, iconAlongLine, true);

            numIconVertices = iconQuads.length * 4;

            const iconSizeData = getSizeVertexData(layer,
                this.zoom,
                this.iconSizeData.coveringZoomRange,
                'icon-size',
                featureProperties);

            this.addSymbols(
                this.arrays.icon,
                iconQuads,
                iconSizeData,
                iconOffset,
                iconAlongLine,
                featureProperties,
                false,
                anchor,
                lineArray.lineStartIndex,
                lineArray.lineLength,
                this.placedIconArray);
        }

        const iconBoxStartIndex = iconCollisionFeature ? iconCollisionFeature.boxStartIndex : this.collisionBoxArray.length;
        const iconBoxEndIndex = iconCollisionFeature ? iconCollisionFeature.boxEndIndex : this.collisionBoxArray.length;

        if (textBoxEndIndex > SymbolBucket.MAX_INSTANCES) util.warnOnce("Too many symbols being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");
        if (iconBoxEndIndex > SymbolBucket.MAX_INSTANCES) util.warnOnce("Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");

        const writingModes = (
            (shapedTextOrientations[WritingMode.vertical] ? WritingMode.vertical : 0) |
            (shapedTextOrientations[WritingMode.horizontal] ? WritingMode.horizontal : 0)
        );

        this.symbolInstances.push({
            key,
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
            featureProperties,
            writingModes,
            numGlyphVertices,
            numVerticalGlyphVertices,
            numIconVertices,
            placedTextSymbolIndex
        });
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

function getSizeVertexData(layer, tileZoom, stopZoomLevels, sizeProperty, featureProperties) {
    if (
        layer.isLayoutValueZoomConstant(sizeProperty) &&
        !layer.isLayoutValueFeatureConstant(sizeProperty)
    ) {
        // source function
        return [
            10 * layer.getLayoutValue(sizeProperty, {}, featureProperties)
        ];
    } else if (
        !layer.isLayoutValueZoomConstant(sizeProperty) &&
        !layer.isLayoutValueFeatureConstant(sizeProperty)
    ) {
        // composite function
        return [
            10 * layer.getLayoutValue(sizeProperty, {zoom: stopZoomLevels[0]}, featureProperties),
            10 * layer.getLayoutValue(sizeProperty, {zoom: stopZoomLevels[1]}, featureProperties)
        ];
    }
    // camera function or constant
    return null;
}

SymbolBucket.programInterfaces = symbolInterfaces;

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, iconBoxEndIndex and textBoxEndIndex
// eg the max valid UInt16 is 65,535
SymbolBucket.MAX_INSTANCES = 65535;

SymbolBucket.addDynamicAttributes = addDynamicAttributes;

module.exports = SymbolBucket;
