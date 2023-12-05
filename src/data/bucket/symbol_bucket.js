// @flow

import {symbolLayoutAttributes,
    symbolGlobeExtAttributes,
    collisionVertexAttributes,
    collisionVertexAttributesExt,
    collisionBoxLayout,
    dynamicLayoutAttributes,
    iconTransitioningAttributes,
    zOffsetAttributes
} from './symbol_attributes.js';

import {SymbolLayoutArray,
    SymbolGlobeExtArray,
    SymbolDynamicLayoutArray,
    SymbolOpacityArray,
    CollisionBoxLayoutArray,
    CollisionVertexExtArray,
    CollisionVertexArray,
    PlacedSymbolArray,
    SymbolInstanceArray,
    GlyphOffsetArray,
    SymbolLineVertexArray,
    SymbolIconTransitioningArray,
    ZOffsetVertexArray
} from '../array_types.js';

import ONE_EM from '../../symbol/one_em.js';
import * as symbolSize from '../../symbol/symbol_size.js';
import Point from '@mapbox/point-geometry';
import SegmentVector from '../segment.js';
import {ProgramConfigurationSet} from '../program_configuration.js';
import {TriangleIndexArray, LineIndexArray} from '../index_array_type.js';
import transformText from '../../symbol/transform_text.js';
import mergeLines from '../../symbol/mergelines.js';
import {allowsVerticalWritingMode, stringContainsRTLText} from '../../util/script_detection.js';
import {WritingMode} from '../../symbol/shaping.js';
import loadGeometry from '../load_geometry.js';
import toEvaluationFeature from '../evaluation_feature.js';
import {VectorTileFeature} from '@mapbox/vector-tile';
const vectorTileFeatureTypes = VectorTileFeature.types;
import {verticalizedCharacterMap} from '../../util/verticalize_punctuation.js';
import Anchor from '../../symbol/anchor.js';
import {getSizeData} from '../../symbol/symbol_size.js';
import {MAX_PACKED_SIZE} from '../../symbol/symbol_layout.js';
import {register} from '../../util/web_worker_transfer.js';
import EvaluationParameters from '../../style/evaluation_parameters.js';
import Formatted from '../../style-spec/expression/types/formatted.js';
import ResolvedImage from '../../style-spec/expression/types/resolved_image.js';
import {plugin as globalRTLTextPlugin, getRTLTextPluginStatus} from '../../source/rtl_text_plugin.js';
import {resamplePred} from '../../geo/projection/resample.js';
import {tileCoordToECEF} from '../../geo/projection/globe_util.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';
import {getProjection} from '../../geo/projection/index.js';
import type Projection from '../../geo/projection/projection.js';
import {mat4, vec3} from 'gl-matrix';
import assert from 'assert';

import type {CanonicalTileID, OverscaledTileID} from '../../source/tile_id.js';
import type {
    Bucket,
    BucketParameters,
    IndexedFeature,
    PopulateParameters
} from '../bucket.js';
import type {CollisionBoxArray, CollisionBox, SymbolInstance, StructArrayLayout1f4} from '../array_types.js';
import type {StructArray, StructArrayMember} from '../../util/struct_array.js';
import SymbolStyleLayer from '../../style/style_layer/symbol_style_layer.js';
import type Context from '../../gl/context.js';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type {SymbolQuad} from '../../symbol/quads.js';
import type {SizeData} from '../../symbol/symbol_size.js';
import type {FeatureStates} from '../../source/source_state.js';
import type {TileTransform} from '../../geo/projection/tile_transform.js';
export type SingleCollisionBox = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    padding: number;
    projectedAnchorX: number;
    projectedAnchorY: number;
    projectedAnchorZ: number;
    tileAnchorX: number;
    tileAnchorY: number;
    elevation?: number;
    tileID?: OverscaledTileID;
};
import type {Mat4, Vec3} from 'gl-matrix';
import type {SpritePositions} from '../../util/image.js';
import type {IVectorTileLayer} from '@mapbox/vector-tile';

export type CollisionArrays = {
    textBox?: SingleCollisionBox;
    verticalTextBox?: SingleCollisionBox;
    iconBox?: SingleCollisionBox;
    verticalIconBox?: SingleCollisionBox;
    textFeatureIndex?: number;
    verticalTextFeatureIndex?: number;
    iconFeatureIndex?: number;
    verticalIconFeatureIndex?: number;
};

export type SymbolFeature = {|
    sortKey: number | void,
    text: Formatted | void,
    icon: ?ResolvedImage,
    index: number,
    sourceLayerIndex: number,
    geometry: Array<Array<Point>>,
    properties: Object,
    type: 'Point' | 'LineString' | 'Polygon',
    id?: any
|};

export type SortKeyRange = {
    sortKey: number,
    symbolInstanceStart: number,
    symbolInstanceEnd: number
};

type LineVertexRange = {|
    lineLength: number,
    lineStartIndex: number
|};

// Opacity arrays are frequently updated but don't contain a lot of information, so we pack them
// tight. Each Uint32 is actually four duplicate Uint8s for the four corners of a glyph
// 7 bits are for the current opacity, and the lowest bit is the target opacity

// actually defined in symbol_attributes.js
// const placementOpacityAttributes = [
//     { name: 'a_fade_opacity', components: 1, type: 'Uint32' }
// ];
const shaderOpacityAttributes = [
    {name: 'a_fade_opacity', components: 1, type: 'Uint8', offset: 0}
];

function addVertex(array: SymbolLayoutArray, tileAnchorX: number, tileAnchorY: number, ox: number, oy: number, tx: number, ty: number, sizeVertex: any, isSDF: boolean, pixelOffsetX: number, pixelOffsetY: number, minFontScaleX: number, minFontScaleY: number) {
    const aSizeX = sizeVertex ? Math.min(MAX_PACKED_SIZE, Math.round(sizeVertex[0])) : 0;
    const aSizeY = sizeVertex ? Math.min(MAX_PACKED_SIZE, Math.round(sizeVertex[1])) : 0;

    array.emplaceBack(
        // a_pos_offset
        tileAnchorX,
        tileAnchorY,
        Math.round(ox * 32),
        Math.round(oy * 32),

        // a_data
        tx, // x coordinate of symbol on glyph atlas texture
        ty, // y coordinate of symbol on glyph atlas texture
        (aSizeX << 1) + (isSDF ? 1 : 0),
        aSizeY,
        pixelOffsetX * 16,
        pixelOffsetY * 16,
        minFontScaleX * 256,
        minFontScaleY * 256
    );
}

function addTransitioningVertex(array: SymbolIconTransitioningArray, tx: number, ty: number) {
    array.emplaceBack(tx, ty);
}

function addGlobeVertex(array: SymbolGlobeExtArray, projAnchorX: number, projAnchorY: number, projAnchorZ: number, normX: number, normY: number, normZ: number) {
    array.emplaceBack(
        // a_globe_anchor
        projAnchorX,
        projAnchorY,
        projAnchorZ,

        // a_globe_normal
        normX,
        normY,
        normZ
    );
}

function updateGlobeVertexNormal(array: SymbolGlobeExtArray, vertexIdx: number, normX: number, normY: number, normZ: number) {
    // Modify float32 array directly. 20 bytes per entry, 3xInt16 for position, 3xfloat32 for normal
    const offset = vertexIdx * 5 + 2;
    array.float32[offset + 0] = normX;
    array.float32[offset + 1] = normY;
    array.float32[offset + 2] = normZ;
}

function addDynamicAttributes(dynamicLayoutVertexArray: StructArray, x: number, y: number, z: number, angle: number) {
    dynamicLayoutVertexArray.emplaceBack(x, y, z, angle);
    dynamicLayoutVertexArray.emplaceBack(x, y, z, angle);
    dynamicLayoutVertexArray.emplaceBack(x, y, z, angle);
    dynamicLayoutVertexArray.emplaceBack(x, y, z, angle);
}

function containsRTLText(formattedText: Formatted): boolean {
    for (const section of formattedText.sections) {
        if (stringContainsRTLText(section.text)) {
            return true;
        }
    }
    return false;
}

export class SymbolBuffers {
    layoutVertexArray: SymbolLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet<SymbolStyleLayer>;
    segments: SegmentVector;

    dynamicLayoutVertexArray: SymbolDynamicLayoutArray;
    dynamicLayoutVertexBuffer: VertexBuffer;

    opacityVertexArray: SymbolOpacityArray;
    opacityVertexBuffer: VertexBuffer;

    zOffsetVertexArray: ZOffsetVertexArray;
    zOffsetVertexBuffer: VertexBuffer;

    iconTransitioningVertexArray: SymbolIconTransitioningArray;
    iconTransitioningVertexBuffer: ?VertexBuffer;

    globeExtVertexArray: SymbolGlobeExtArray;
    globeExtVertexBuffer: ?VertexBuffer;

    placedSymbolArray: PlacedSymbolArray;

    constructor(programConfigurations: ProgramConfigurationSet<SymbolStyleLayer>) {
        this.layoutVertexArray = new SymbolLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = programConfigurations;
        this.segments = new SegmentVector();
        this.dynamicLayoutVertexArray = new SymbolDynamicLayoutArray();
        this.opacityVertexArray = new SymbolOpacityArray();
        this.placedSymbolArray = new PlacedSymbolArray();
        this.iconTransitioningVertexArray = new SymbolIconTransitioningArray();
        this.globeExtVertexArray = new SymbolGlobeExtArray();
        this.zOffsetVertexArray = new ZOffsetVertexArray();
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0 &&
            this.indexArray.length === 0 &&
            this.dynamicLayoutVertexArray.length === 0 &&
            this.opacityVertexArray.length === 0 &&
            this.iconTransitioningVertexArray.length === 0;
    }

    upload(context: Context, dynamicIndexBuffer: boolean, upload?: boolean, update?: boolean, createZOffsetBuffer?: boolean) {
        if (this.isEmpty()) {
            return;
        }

        if (upload) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, symbolLayoutAttributes.members);
            this.indexBuffer = context.createIndexBuffer(this.indexArray, dynamicIndexBuffer);
            this.dynamicLayoutVertexBuffer = context.createVertexBuffer(this.dynamicLayoutVertexArray, dynamicLayoutAttributes.members, true);
            this.opacityVertexBuffer = context.createVertexBuffer(this.opacityVertexArray, shaderOpacityAttributes, true);
            if (this.iconTransitioningVertexArray.length > 0) {
                this.iconTransitioningVertexBuffer = context.createVertexBuffer(this.iconTransitioningVertexArray, iconTransitioningAttributes.members, true);
            }
            if (this.globeExtVertexArray.length > 0) {
                this.globeExtVertexBuffer = context.createVertexBuffer(this.globeExtVertexArray, symbolGlobeExtAttributes.members, true);
            }
            if (!this.zOffsetVertexBuffer && (this.zOffsetVertexArray.length > 0 || !!createZOffsetBuffer)) {
                this.zOffsetVertexBuffer = context.createVertexBuffer(this.zOffsetVertexArray, zOffsetAttributes.members, true);
            }
            // This is a performance hack so that we can write to opacityVertexArray with uint32s
            // even though the shaders read uint8s
            this.opacityVertexBuffer.itemSize = 1;
        }
        if (upload || update) {
            this.programConfigurations.upload(context);
        }
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.dynamicLayoutVertexBuffer.destroy();
        this.opacityVertexBuffer.destroy();
        if (this.iconTransitioningVertexBuffer) {
            this.iconTransitioningVertexBuffer.destroy();
        }
        if (this.globeExtVertexBuffer) {
            this.globeExtVertexBuffer.destroy();
        }
        if (this.zOffsetVertexBuffer) {
            this.zOffsetVertexBuffer.destroy();
        }
    }
}

register(SymbolBuffers, 'SymbolBuffers');

class CollisionBuffers {
    layoutVertexArray: StructArray;
    layoutAttributes: Array<StructArrayMember>;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray | LineIndexArray;
    indexBuffer: IndexBuffer;

    segments: SegmentVector;

    collisionVertexArray: CollisionVertexArray;
    collisionVertexBuffer: VertexBuffer;

    collisionVertexArrayExt: CollisionVertexExtArray;
    collisionVertexBufferExt: VertexBuffer;

    constructor(LayoutArray: Class<StructArray>,
                layoutAttributes: Array<StructArrayMember>,
                IndexArray: Class<TriangleIndexArray | LineIndexArray>) {
        this.layoutVertexArray = new LayoutArray();
        this.layoutAttributes = layoutAttributes;
        this.indexArray = new IndexArray();
        this.segments = new SegmentVector();
        this.collisionVertexArray = new CollisionVertexArray();
        this.collisionVertexArrayExt = new CollisionVertexExtArray();
    }

    upload(context: Context) {
        this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, this.layoutAttributes);
        this.indexBuffer = context.createIndexBuffer(this.indexArray);
        this.collisionVertexBuffer = context.createVertexBuffer(this.collisionVertexArray, collisionVertexAttributes.members, true);
        this.collisionVertexBufferExt = context.createVertexBuffer(this.collisionVertexArrayExt, collisionVertexAttributesExt.members, true);
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.segments.destroy();
        this.collisionVertexBuffer.destroy();
        this.collisionVertexBufferExt.destroy();
    }
}

register(CollisionBuffers, 'CollisionBuffers');

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
 *      `collisionBoxArray`: collision data for use by foreground
 *      `this.text`: SymbolBuffers for text symbols
 *      `this.icons`: SymbolBuffers for icons
 *      `this.iconCollisionBox`: Debug SymbolBuffers for icon collision boxes
 *      `this.textCollisionBox`: Debug SymbolBuffers for text collision boxes
 *    The results are sent to the foreground for rendering
 *
 * 4. Placement.updateBucketOpacities() is run on the foreground,
 *    and uses the CollisionIndex along with current camera settings to determine
 *    which symbols can actually show on the map. Collided symbols are hidden
 *    using a dynamic "OpacityVertexArray".
 *
 * @private
 */
class SymbolBucket implements Bucket {
    static MAX_GLYPHS: number;
    static addDynamicAttributes: typeof addDynamicAttributes;

    collisionBoxArray: CollisionBoxArray;
    zoom: number;
    overscaling: number;
    layers: Array<SymbolStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<SymbolStyleLayer>;
    stateDependentLayerIds: Array<string>;

    index: number;
    sdfIcons: boolean;
    iconsInText: boolean;
    iconsNeedLinear: boolean;
    bucketInstanceId: number;
    justReloaded: boolean;
    hasPattern: boolean;
    fullyClipped: boolean;

    textSizeData: SizeData;
    iconSizeData: SizeData;

    glyphOffsetArray: GlyphOffsetArray;
    lineVertexArray: SymbolLineVertexArray;
    features: Array<SymbolFeature>;
    symbolInstances: SymbolInstanceArray;
    collisionArrays: Array<CollisionArrays>;
    sortKeyRanges: Array<SortKeyRange>;
    pixelRatio: number;
    tilePixelRatio: number;
    compareText: {[_: string]: Array<Point>};
    fadeStartTime: number;
    sortFeaturesByKey: boolean;
    sortFeaturesByY: boolean;
    canOverlap: boolean;
    sortedAngle: number;
    featureSortOrder: Array<number>;

    collisionCircleArray: Array<number>;
    placementInvProjMatrix: Mat4;
    placementViewportMatrix: Mat4;

    text: SymbolBuffers;
    icon: SymbolBuffers;
    textCollisionBox: CollisionBuffers;
    iconCollisionBox: CollisionBuffers;
    uploaded: boolean;
    sourceLayerIndex: number;
    sourceID: string;
    symbolInstanceIndexes: Array<number>;
    writingModes: Array<number>;
    allowVerticalPlacement: boolean;
    hasRTLText: boolean;
    projection: ProjectionSpecification;
    projectionInstance: ?Projection;
    hasAnyIconTextFit: boolean;
    hasAnyZOffset: boolean;
    symbolInstanceIndexesSortedZOffset: Array<number>;
    zOffsetSortDirty: boolean;
    zOffsetBuffersNeedUpload: boolean;

    constructor(options: BucketParameters<SymbolStyleLayer>) {
        this.collisionBoxArray = options.collisionBoxArray;
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.pixelRatio = options.pixelRatio;
        this.sourceLayerIndex = options.sourceLayerIndex;
        this.hasPattern = false;
        this.hasRTLText = false;
        this.fullyClipped = false;
        this.hasAnyIconTextFit = false;
        this.sortKeyRanges = [];

        this.collisionCircleArray = [];
        this.placementInvProjMatrix = mat4.identity([]);
        this.placementViewportMatrix = mat4.identity([]);

        const layer = this.layers[0];
        const unevaluatedLayoutValues = layer._unevaluatedLayout._values;

        this.textSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['text-size']);
        this.iconSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['icon-size']);

        const layout = this.layers[0].layout;
        const sortKey = layout.get('symbol-sort-key');
        const zOrder = layout.get('symbol-z-order');
        this.canOverlap =
            layout.get('text-allow-overlap') ||
            layout.get('icon-allow-overlap') ||
            layout.get('text-ignore-placement') ||
            layout.get('icon-ignore-placement');
        this.sortFeaturesByKey = zOrder !== 'viewport-y' && sortKey.constantOr(1) !== undefined;
        const zOrderByViewportY = zOrder === 'viewport-y' || (zOrder === 'auto' && !this.sortFeaturesByKey);
        this.sortFeaturesByY = zOrderByViewportY && this.canOverlap;

        this.writingModes = layout.get('text-writing-mode').map(wm => WritingMode[wm]);

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);

        this.sourceID = options.sourceID;
        this.projection = options.projection;
        this.hasAnyZOffset = false;
        this.zOffsetSortDirty = false;
        this.zOffsetBuffersNeedUpload = layout.get('symbol-z-elevate');
    }

    createArrays() {
        this.text = new SymbolBuffers(new ProgramConfigurationSet(this.layers, this.zoom, property => /^text/.test(property)));
        this.icon = new SymbolBuffers(new ProgramConfigurationSet(this.layers, this.zoom, property => /^icon/.test(property)));

        this.glyphOffsetArray = new GlyphOffsetArray();
        this.lineVertexArray = new SymbolLineVertexArray();
        this.symbolInstances = new SymbolInstanceArray();
    }

    calculateGlyphDependencies(text: string, stack: {[_: number]: boolean}, textAlongLine: boolean, allowVerticalPlacement: boolean, doesAllowVerticalWritingMode: boolean) {
        for (let i = 0; i < text.length; i++) {
            const codePoint = text.codePointAt(i);
            if (codePoint === undefined) break;
            stack[codePoint] = true;
            if (allowVerticalPlacement && doesAllowVerticalWritingMode && codePoint <= 65535) {
                const verticalChar = verticalizedCharacterMap[text.charAt(i)];
                if (verticalChar) {
                    stack[verticalChar.charCodeAt(0)] = true;
                }
            }
        }
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        const layer = this.layers[0];
        const layout = layer.layout;
        const isGlobe = this.projection.name === 'globe';

        const textFont = layout.get('text-font');
        const textField = layout.get('text-field');
        const iconImage = layout.get('icon-image');
        const hasText =
            (textField.value.kind !== 'constant' ||
                (textField.value.value instanceof Formatted && !textField.value.value.isEmpty()) ||
                textField.value.value.toString().length > 0) &&
            (textFont.value.kind !== 'constant' || textFont.value.value.length > 0);
        // we should always resolve the icon-image value if the property was defined in the style
        // this allows us to fire the styleimagemissing event if image evaluation returns null
        // the only way to distinguish between null returned from a coalesce statement with no valid images
        // and null returned because icon-image wasn't defined is to check whether or not iconImage.parameters is an empty object
        const hasIcon = iconImage.value.kind !== 'constant' || !!iconImage.value.value || Object.keys(iconImage.parameters).length > 0;
        const symbolSortKey = layout.get('symbol-sort-key');

        this.features = [];

        if (!hasText && !hasIcon) {
            return;
        }

        const icons = options.iconDependencies;
        const stacks = options.glyphDependencies;
        const availableImages = options.availableImages;
        const globalProperties = new EvaluationParameters(this.zoom);

        for (const {feature, id, index, sourceLayerIndex} of features) {

            const needGeometry = layer._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            // $FlowFixMe[method-unbinding]
            if (!layer._featureFilter.filter(globalProperties, evaluationFeature, canonical)) {
                continue;
            }

            if (!needGeometry) evaluationFeature.geometry = loadGeometry(feature, canonical, tileTransform);

            if (isGlobe && feature.type !== 1 && canonical.z <= 5) {
                // Resample long lines and polygons in globe view so that their length wont exceed ~0.19 radians (360/32 degrees).
                // Otherwise lines could clip through the globe as the resolution is not enough to represent curved paths.
                // The threshold value follows subdivision size used with fill extrusions
                const geom = evaluationFeature.geometry;

                // cos(11.25 degrees) = 0.98078528056
                const cosAngleThreshold = 0.98078528056;
                const predicate = (a: Point, b: Point) => {
                    const v0 = tileCoordToECEF(a.x, a.y, canonical, 1);
                    const v1 = tileCoordToECEF(b.x, b.y, canonical, 1);
                    return vec3.dot(v0, v1) < cosAngleThreshold;
                };

                for (let i = 0; i < geom.length; i++) {
                    geom[i] = resamplePred(geom[i], predicate);
                }
            }

            let text: Formatted | void;
            if (hasText) {
                // Expression evaluation will automatically coerce to Formatted
                // but plain string token evaluation skips that pathway so do the
                // conversion here.
                const resolvedTokens = layer.getValueAndResolveTokens('text-field', evaluationFeature, canonical, availableImages);
                const formattedText = Formatted.factory(resolvedTokens);
                if (containsRTLText(formattedText)) {
                    this.hasRTLText = true;
                }
                if (
                    !this.hasRTLText || // non-rtl text so can proceed safely
                    getRTLTextPluginStatus() === 'unavailable' || // We don't intend to lazy-load the rtl text plugin, so proceed with incorrect shaping
                    (this.hasRTLText && globalRTLTextPlugin.isParsed()) // Use the rtlText plugin to shape text
                ) {
                    text = transformText(formattedText, layer, evaluationFeature);
                }
            }

            let icon: ?ResolvedImage;
            if (hasIcon) {
                // Expression evaluation will automatically coerce to Image
                // but plain string token evaluation skips that pathway so do the
                // conversion here.
                const resolvedTokens = layer.getValueAndResolveTokens('icon-image', evaluationFeature, canonical, availableImages);
                if (resolvedTokens instanceof ResolvedImage) {
                    icon = resolvedTokens;
                } else {
                    icon = ResolvedImage.fromString(resolvedTokens);
                }
            }

            if (!text && !icon) {
                continue;
            }
            const sortKey = this.sortFeaturesByKey ?
                symbolSortKey.evaluate(evaluationFeature, {}, canonical) :
                undefined;

            const symbolFeature: SymbolFeature = {
                id,
                text,
                icon,
                index,
                sourceLayerIndex,
                geometry: evaluationFeature.geometry,
                properties: feature.properties,
                type: vectorTileFeatureTypes[feature.type],
                sortKey
            };
            this.features.push(symbolFeature);

            if (icon) {
                icons[icon.namePrimary] = true;
                if (icon.nameSecondary) {
                    icons[icon.nameSecondary] = true;
                }
            }

            if (text) {
                const fontStack = textFont.evaluate(evaluationFeature, {}, canonical).join(',');
                const textAlongLine = layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') !== 'point';
                this.allowVerticalPlacement = this.writingModes && this.writingModes.indexOf(WritingMode.vertical) >= 0;
                for (const section of text.sections) {
                    if (!section.image) {
                        const doesAllowVerticalWritingMode = allowsVerticalWritingMode(text.toString());
                        const sectionFont = section.fontStack || fontStack;
                        const sectionStack = stacks[sectionFont] = stacks[sectionFont] || {};
                        this.calculateGlyphDependencies(section.text, sectionStack, textAlongLine, this.allowVerticalPlacement, doesAllowVerticalWritingMode);
                    } else {
                        // Add section image to the list of dependencies.
                        icons[section.image.namePrimary] = true;
                    }
                }
            }
        }

        if (layout.get('symbol-placement') === 'line') {
            // Merge adjacent lines with the same text to improve labelling.
            // It's better to place labels on one long line than on many short segments.
            this.features = mergeLines(this.features);
        }

        if (this.sortFeaturesByKey) {
            this.features.sort((a, b) => {
                // a.sortKey is always a number when sortFeaturesByKey is true
                return ((a.sortKey: any): number) - ((b.sortKey: any): number);
            });
        }
    }

    update(states: FeatureStates, vtLayer: IVectorTileLayer, availableImages: Array<string>, imagePositions: SpritePositions, brightness: ?number) {
        const withStateUpdates = Object.keys(states).length !== 0;
        if (withStateUpdates && !this.stateDependentLayers.length) return;
        const layers = withStateUpdates ? this.stateDependentLayers : this.layers;
        this.text.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, brightness);
        this.icon.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, brightness);
    }

    updateZOffset() {
        // z offset is expected to change less frequently than the placement opacity and, if values are the same,
        // avoid uploading arrays to buffers.
        const addZOffsetTextVertex = (array: StructArrayLayout1f4, numVertices: number, value: number) => {
            currentTextZOffsetVertex += numVertices;
            if (currentTextZOffsetVertex > array.length) {
                array.resize(currentTextZOffsetVertex);
            }
            for (let i = -numVertices; i < 0; i++) {
                array.emplace(i + currentTextZOffsetVertex, value);
            }
        };
        const addZOffsetIconVertex = (array: StructArrayLayout1f4, numVertices: number, value: number) => {
            currentIconZOffsetVertex += numVertices;
            if (currentIconZOffsetVertex > array.length) {
                array.resize(currentIconZOffsetVertex);
            }
            for (let i = -numVertices; i < 0; i++) {
                array.emplace(i + currentIconZOffsetVertex, value);
            }
        };

        const updateZOffset = this.zOffsetBuffersNeedUpload;
        if (!updateZOffset) return;
        this.zOffsetBuffersNeedUpload = false;
        let currentTextZOffsetVertex = 0;
        let currentIconZOffsetVertex = 0;
        for (let s = 0; s < this.symbolInstances.length; s++) {
            const symbolInstance = this.symbolInstances.get(s);
            const {
                numHorizontalGlyphVertices,
                numVerticalGlyphVertices,
                numIconVertices
            } = symbolInstance;
            const zOffset = symbolInstance.zOffset;
            const hasText = numHorizontalGlyphVertices > 0 || numVerticalGlyphVertices > 0;
            const hasIcon = numIconVertices > 0;
            if (hasText) {
                addZOffsetTextVertex(this.text.zOffsetVertexArray, numHorizontalGlyphVertices, zOffset);
                addZOffsetTextVertex(this.text.zOffsetVertexArray, numVerticalGlyphVertices, zOffset);
            }
            if (hasIcon) {
                const {placedIconSymbolIndex, verticalPlacedIconSymbolIndex} = symbolInstance;
                if (placedIconSymbolIndex >= 0) {
                    addZOffsetIconVertex(this.icon.zOffsetVertexArray, numIconVertices, zOffset);
                }

                if (verticalPlacedIconSymbolIndex >= 0) {
                    addZOffsetIconVertex(this.icon.zOffsetVertexArray, symbolInstance.numVerticalIconVertices, zOffset);
                }
            }
        }

        if (this.text.zOffsetVertexBuffer) {
            this.text.zOffsetVertexBuffer.updateData(this.text.zOffsetVertexArray);
            assert(this.text.zOffsetVertexBuffer.length === this.text.layoutVertexArray.length);
        }
        if (this.icon.zOffsetVertexBuffer) {
            this.icon.zOffsetVertexBuffer.updateData(this.icon.zOffsetVertexArray);
            assert(this.icon.zOffsetVertexBuffer.length === this.icon.layoutVertexArray.length);
        }

    }

    isEmpty(): boolean {
        // When the bucket encounters only rtl-text but the plugin isn't loaded, no symbol instances will be created.
        // In order for the bucket to be serialized, and not discarded as an empty bucket both checks are necessary.
        return this.symbolInstances.length === 0 && !this.hasRTLText;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.text.programConfigurations.needsUpload || this.icon.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded && this.hasDebugData()) {
            this.textCollisionBox.upload(context);
            this.iconCollisionBox.upload(context);
        }
        this.text.upload(context, this.sortFeaturesByY, !this.uploaded, this.text.programConfigurations.needsUpload, this.zOffsetBuffersNeedUpload);
        this.icon.upload(context, this.sortFeaturesByY, !this.uploaded, this.icon.programConfigurations.needsUpload, this.zOffsetBuffersNeedUpload);
        this.uploaded = true;
    }

    destroyDebugData() {
        this.textCollisionBox.destroy();
        this.iconCollisionBox.destroy();
    }

    getProjection(): Projection {
        if (!this.projectionInstance) {
            this.projectionInstance = getProjection(this.projection);
        }
        return this.projectionInstance;
    }

    destroy() {
        this.text.destroy();
        this.icon.destroy();

        if (this.hasDebugData()) {
            this.destroyDebugData();
        }
    }

    addToLineVertexArray(anchor: Anchor, line: Array<Point>): LineVertexRange {
        const lineStartIndex = this.lineVertexArray.length;
        if (anchor.segment !== undefined) {
            for (const {x, y} of line) {
                this.lineVertexArray.emplaceBack(x, y);
            }
        }
        return {
            lineStartIndex,
            lineLength: this.lineVertexArray.length - lineStartIndex
        };
    }

    addSymbols(arrays: SymbolBuffers,
               quads: Array<SymbolQuad>,
               sizeVertex: any,
               lineOffset: [number, number],
               alongLine: boolean,
               feature: SymbolFeature,
               writingMode: any,
               globe: ?{ anchor: Anchor, up: Vec3 },
               tileAnchor: Anchor,
               lineStartIndex: number,
               lineLength: number,
               associatedIconIndex: number,
               availableImages: Array<string>,
               canonical: CanonicalTileID,
               brightness: ?number,
               hasAnySecondaryIcon: boolean) {
        const indexArray = arrays.indexArray;
        const layoutVertexArray = arrays.layoutVertexArray;
        const globeExtVertexArray = arrays.globeExtVertexArray;

        const segment = arrays.segments.prepareSegment(4 * quads.length, layoutVertexArray, indexArray, this.canOverlap ? feature.sortKey : undefined);
        const glyphOffsetArrayStart = this.glyphOffsetArray.length;
        const vertexStartIndex = segment.vertexLength;

        const angle = (this.allowVerticalPlacement && writingMode === WritingMode.vertical) ? Math.PI / 2 : 0;

        const sections = feature.text && feature.text.sections;

        for (let i = 0; i < quads.length; i++) {
            const {tl, tr, bl, br, texPrimary, texSecondary, pixelOffsetTL, pixelOffsetBR, minFontScaleX, minFontScaleY, glyphOffset, isSDF, sectionIndex} = quads[i];
            const index = segment.vertexLength;

            const y = glyphOffset[1];
            addVertex(layoutVertexArray, tileAnchor.x, tileAnchor.y, tl.x, y + tl.y, texPrimary.x, texPrimary.y, sizeVertex, isSDF, pixelOffsetTL.x, pixelOffsetTL.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, tileAnchor.x, tileAnchor.y, tr.x, y + tr.y, texPrimary.x + texPrimary.w, texPrimary.y, sizeVertex, isSDF, pixelOffsetBR.x, pixelOffsetTL.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, tileAnchor.x, tileAnchor.y, bl.x, y + bl.y, texPrimary.x, texPrimary.y + texPrimary.h, sizeVertex, isSDF, pixelOffsetTL.x, pixelOffsetBR.y, minFontScaleX, minFontScaleY);
            addVertex(layoutVertexArray, tileAnchor.x, tileAnchor.y, br.x, y + br.y, texPrimary.x + texPrimary.w, texPrimary.y + texPrimary.h, sizeVertex, isSDF, pixelOffsetBR.x, pixelOffsetBR.y, minFontScaleX, minFontScaleY);

            if (globe) {
                const {x, y, z} = globe.anchor;
                const [ux, uy, uz] = globe.up;
                addGlobeVertex(globeExtVertexArray, x, y, z, ux, uy, uz);
                addGlobeVertex(globeExtVertexArray, x, y, z, ux, uy, uz);
                addGlobeVertex(globeExtVertexArray, x, y, z, ux, uy, uz);
                addGlobeVertex(globeExtVertexArray, x, y, z, ux, uy, uz);

                addDynamicAttributes(arrays.dynamicLayoutVertexArray, x, y, z, angle);
            } else {
                addDynamicAttributes(arrays.dynamicLayoutVertexArray, tileAnchor.x, tileAnchor.y, tileAnchor.z, angle);
            }

            // For data-driven cases if at least of one the icon has a transitionable variant
            // we have to load the main variant in cases where the secondary image is not specified
            if (hasAnySecondaryIcon) {
                const tex = texSecondary ? texSecondary : texPrimary;
                addTransitioningVertex(arrays.iconTransitioningVertexArray, tex.x, tex.y);
                addTransitioningVertex(arrays.iconTransitioningVertexArray, tex.x + tex.w, tex.y);
                addTransitioningVertex(arrays.iconTransitioningVertexArray, tex.x, tex.y + tex.h);
                addTransitioningVertex(arrays.iconTransitioningVertexArray, tex.x + tex.w, tex.y + tex.h);
            }

            indexArray.emplaceBack(index, index + 1, index + 2);
            indexArray.emplaceBack(index + 1, index + 2, index + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;

            this.glyphOffsetArray.emplaceBack(glyphOffset[0]);

            if (i === quads.length - 1 || sectionIndex !== quads[i + 1].sectionIndex) {
                arrays.programConfigurations.populatePaintArrays(layoutVertexArray.length, feature, feature.index, {}, availableImages, canonical, brightness, sections && sections[sectionIndex]);
            }
        }

        const projectedAnchor = globe ? globe.anchor : tileAnchor;

        arrays.placedSymbolArray.emplaceBack(projectedAnchor.x, projectedAnchor.y, projectedAnchor.z, tileAnchor.x, tileAnchor.y,
            glyphOffsetArrayStart, this.glyphOffsetArray.length - glyphOffsetArrayStart, vertexStartIndex,
            lineStartIndex, lineLength, (tileAnchor.segment: any),
            sizeVertex ? sizeVertex[0] : 0, sizeVertex ? sizeVertex[1] : 0,
            lineOffset[0], lineOffset[1],
            writingMode,
            // placedOrientation is null initially; will be updated to horizontal(1)/vertical(2) if placed
            0,
            (false: any),
            // The crossTileID is only filled/used on the foreground for dynamic text anchors
            0,
            associatedIconIndex,
            // flipState is unknown initially; will be updated to flipRequired(1)/flipNotRequired(2) during line label reprojection
            0
        );
    }

    _commitLayoutVertex(array: StructArray, boxTileAnchorX: number, boxTileAnchorY: number, boxTileAnchorZ: number, tileAnchorX: number, tileAnchorY: number, extrude: Point) {
        array.emplaceBack(
            // pos
            boxTileAnchorX,
            boxTileAnchorY,
            boxTileAnchorZ,
            // a_anchor_pos
            tileAnchorX,
            tileAnchorY,
            // extrude
            Math.round(extrude.x),
            Math.round(extrude.y));
    }

    _addCollisionDebugVertices(box: CollisionBox, scale: number, arrays: CollisionBuffers, boxTileAnchorX: number, boxTileAnchorY: number, boxTileAnchorZ: number, symbolInstance: SymbolInstance) {
        const segment = arrays.segments.prepareSegment(4, arrays.layoutVertexArray, arrays.indexArray);
        const index = segment.vertexLength;
        const symbolTileAnchorX = symbolInstance.tileAnchorX;
        const symbolTileAnchorY = symbolInstance.tileAnchorY;

        for (let i = 0; i < 4; i++) {
            arrays.collisionVertexArray.emplaceBack(0, 0, 0, 0);
        }

        this._commitDebugCollisionVertexUpdate(arrays.collisionVertexArrayExt, scale, box.padding, symbolInstance.zOffset);

        this._commitLayoutVertex(arrays.layoutVertexArray, boxTileAnchorX, boxTileAnchorY, boxTileAnchorZ, symbolTileAnchorX, symbolTileAnchorY, new Point(box.x1, box.y1));
        this._commitLayoutVertex(arrays.layoutVertexArray, boxTileAnchorX, boxTileAnchorY, boxTileAnchorZ, symbolTileAnchorX, symbolTileAnchorY, new Point(box.x2, box.y1));
        this._commitLayoutVertex(arrays.layoutVertexArray, boxTileAnchorX, boxTileAnchorY, boxTileAnchorZ, symbolTileAnchorX, symbolTileAnchorY, new Point(box.x2, box.y2));
        this._commitLayoutVertex(arrays.layoutVertexArray, boxTileAnchorX, boxTileAnchorY, boxTileAnchorZ, symbolTileAnchorX, symbolTileAnchorY, new Point(box.x1, box.y2));

        segment.vertexLength += 4;

        const indexArray: LineIndexArray = (arrays.indexArray: any);
        indexArray.emplaceBack(index, index + 1);
        indexArray.emplaceBack(index + 1, index + 2);
        indexArray.emplaceBack(index + 2, index + 3);
        indexArray.emplaceBack(index + 3, index);

        segment.primitiveLength += 4;
    }

    _addTextDebugCollisionBoxes(size: any, zoom: number, collisionBoxArray: CollisionBoxArray, startIndex: number, endIndex: number, instance: SymbolInstance) {
        for (let b = startIndex; b < endIndex; b++) {
            const box: CollisionBox = (collisionBoxArray.get(b): any);
            const scale = this.getSymbolInstanceTextSize(size, instance, zoom, b);

            this._addCollisionDebugVertices(box, scale, this.textCollisionBox, box.projectedAnchorX, box.projectedAnchorY, box.projectedAnchorZ, instance);
        }
    }

    _addIconDebugCollisionBoxes(size: any, zoom: number, collisionBoxArray: CollisionBoxArray, startIndex: number, endIndex: number, instance: SymbolInstance) {
        for (let b = startIndex; b < endIndex; b++) {
            const box: CollisionBox = (collisionBoxArray.get(b): any);
            const scale = this.getSymbolInstanceIconSize(size, zoom, instance.placedIconSymbolIndex);

            this._addCollisionDebugVertices(box, scale, this.iconCollisionBox, box.projectedAnchorX, box.projectedAnchorY, box.projectedAnchorZ, instance);
        }
    }

    generateCollisionDebugBuffers(zoom: number, collisionBoxArray: CollisionBoxArray) {
        if (this.hasDebugData()) {
            this.destroyDebugData();
        }

        this.textCollisionBox = new CollisionBuffers(CollisionBoxLayoutArray, collisionBoxLayout.members, LineIndexArray);
        this.iconCollisionBox = new CollisionBuffers(CollisionBoxLayoutArray, collisionBoxLayout.members, LineIndexArray);

        const iconSize = symbolSize.evaluateSizeForZoom(this.iconSizeData, zoom);
        const textSize = symbolSize.evaluateSizeForZoom(this.textSizeData, zoom);

        for (let i = 0; i < this.symbolInstances.length; i++) {
            const symbolInstance = this.symbolInstances.get(i);
            this._addTextDebugCollisionBoxes(textSize, zoom, collisionBoxArray, symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance);
            this._addTextDebugCollisionBoxes(textSize, zoom, collisionBoxArray, symbolInstance.verticalTextBoxStartIndex, symbolInstance.verticalTextBoxEndIndex, symbolInstance);
            this._addIconDebugCollisionBoxes(iconSize, zoom, collisionBoxArray, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex, symbolInstance);
            this._addIconDebugCollisionBoxes(iconSize, zoom, collisionBoxArray, symbolInstance.verticalIconBoxStartIndex, symbolInstance.verticalIconBoxEndIndex, symbolInstance);
        }
    }

    getSymbolInstanceTextSize(textSize: any, instance: SymbolInstance, zoom: number, boxIndex: number): number {
        const symbolIndex = instance.rightJustifiedTextSymbolIndex >= 0 ?
            instance.rightJustifiedTextSymbolIndex : instance.centerJustifiedTextSymbolIndex >= 0 ?
                instance.centerJustifiedTextSymbolIndex : instance.leftJustifiedTextSymbolIndex >= 0 ?
                    instance.leftJustifiedTextSymbolIndex : instance.verticalPlacedTextSymbolIndex >= 0 ?
                        instance.verticalPlacedTextSymbolIndex : boxIndex;

        const symbol = this.text.placedSymbolArray.get(symbolIndex);
        const featureSize = symbolSize.evaluateSizeForFeature(this.textSizeData, textSize, symbol) / ONE_EM;

        return this.tilePixelRatio * featureSize;
    }

    getSymbolInstanceIconSize(iconSize: any, zoom: number, iconIndex: number): number {
        const symbol = this.icon.placedSymbolArray.get(iconIndex);
        const featureSize = symbolSize.evaluateSizeForFeature(this.iconSizeData, iconSize, symbol);

        return this.tilePixelRatio * featureSize;
    }

    _commitDebugCollisionVertexUpdate(array: StructArray, scale: number, padding: number, zOffset: number) {
        array.emplaceBack(scale, -padding, -padding, zOffset);
        array.emplaceBack(scale,  padding, -padding, zOffset);
        array.emplaceBack(scale,  padding,  padding, zOffset);
        array.emplaceBack(scale, -padding,  padding, zOffset);
    }

    _updateTextDebugCollisionBoxes(size: any, zoom: number, collisionBoxArray: CollisionBoxArray, startIndex: number, endIndex: number, instance: SymbolInstance) {
        for (let b = startIndex; b < endIndex; b++) {
            const box: CollisionBox = (collisionBoxArray.get(b): any);
            const scale = this.getSymbolInstanceTextSize(size, instance, zoom, b);
            const array = this.textCollisionBox.collisionVertexArrayExt;
            this._commitDebugCollisionVertexUpdate(array, scale, box.padding, instance.zOffset);
        }
    }

    _updateIconDebugCollisionBoxes(size: any, zoom: number, collisionBoxArray: CollisionBoxArray, startIndex: number, endIndex: number, instance: SymbolInstance) {
        for (let b = startIndex; b < endIndex; b++) {
            const box = (collisionBoxArray.get(b));
            const scale = this.getSymbolInstanceIconSize(size, zoom, instance.placedIconSymbolIndex);
            const array = this.iconCollisionBox.collisionVertexArrayExt;
            this._commitDebugCollisionVertexUpdate(array, scale, box.padding, instance.zOffset);
        }
    }

    updateCollisionDebugBuffers(zoom: number, collisionBoxArray: CollisionBoxArray) {
        if (!this.hasDebugData()) {
            return;
        }

        if (this.hasTextCollisionBoxData()) this.textCollisionBox.collisionVertexArrayExt.clear();
        if (this.hasIconCollisionBoxData()) this.iconCollisionBox.collisionVertexArrayExt.clear();

        const iconSize = symbolSize.evaluateSizeForZoom(this.iconSizeData, zoom);
        const textSize = symbolSize.evaluateSizeForZoom(this.textSizeData, zoom);

        for (let i = 0; i < this.symbolInstances.length; i++) {
            const symbolInstance = this.symbolInstances.get(i);
            this._updateTextDebugCollisionBoxes(textSize, zoom, collisionBoxArray, symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance);
            this._updateTextDebugCollisionBoxes(textSize, zoom, collisionBoxArray, symbolInstance.verticalTextBoxStartIndex, symbolInstance.verticalTextBoxEndIndex, symbolInstance);
            this._updateIconDebugCollisionBoxes(iconSize, zoom, collisionBoxArray, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex, symbolInstance);
            this._updateIconDebugCollisionBoxes(iconSize, zoom, collisionBoxArray, symbolInstance.verticalIconBoxStartIndex, symbolInstance.verticalIconBoxEndIndex, symbolInstance);
        }

        if (this.hasTextCollisionBoxData() && this.textCollisionBox.collisionVertexBufferExt) {
            this.textCollisionBox.collisionVertexBufferExt.updateData(this.textCollisionBox.collisionVertexArrayExt);
        }
        if (this.hasIconCollisionBoxData() && this.iconCollisionBox.collisionVertexBufferExt) {
            this.iconCollisionBox.collisionVertexBufferExt.updateData(this.iconCollisionBox.collisionVertexArrayExt);
        }
    }

    // These flat arrays are meant to be quicker to iterate over than the source
    // CollisionBoxArray
    _deserializeCollisionBoxesForSymbol(collisionBoxArray: CollisionBoxArray,
        textStartIndex: number, textEndIndex: number,
        verticalTextStartIndex: number, verticalTextEndIndex: number,
        iconStartIndex: number, iconEndIndex: number,
        verticalIconStartIndex: number, verticalIconEndIndex: number): CollisionArrays {

        // Only one box allowed per instance
        const collisionArrays = {};
        if (textStartIndex < textEndIndex) {
            const {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY, featureIndex} = collisionBoxArray.get(textStartIndex);
            collisionArrays.textBox = {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY};
            collisionArrays.textFeatureIndex = featureIndex;
        }
        if (verticalTextStartIndex < verticalTextEndIndex) {
            const {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY, featureIndex} = collisionBoxArray.get(verticalTextStartIndex);
            collisionArrays.verticalTextBox = {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY};
            collisionArrays.verticalTextFeatureIndex = featureIndex;
        }
        if (iconStartIndex < iconEndIndex) {
            const {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY, featureIndex} = collisionBoxArray.get(iconStartIndex);
            collisionArrays.iconBox = {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY};
            collisionArrays.iconFeatureIndex = featureIndex;
        }
        if (verticalIconStartIndex < verticalIconEndIndex) {
            const {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY, featureIndex} = collisionBoxArray.get(verticalIconStartIndex);
            collisionArrays.verticalIconBox = {x1, y1, x2, y2, padding, projectedAnchorX, projectedAnchorY, projectedAnchorZ, tileAnchorX, tileAnchorY};
            collisionArrays.verticalIconFeatureIndex = featureIndex;
        }
        return collisionArrays;
    }

    deserializeCollisionBoxes(collisionBoxArray: CollisionBoxArray) {
        this.collisionArrays = [];
        for (let i = 0; i < this.symbolInstances.length; i++) {
            const symbolInstance = this.symbolInstances.get(i);
            this.collisionArrays.push(this._deserializeCollisionBoxesForSymbol(
                collisionBoxArray,
                symbolInstance.textBoxStartIndex,
                symbolInstance.textBoxEndIndex,
                symbolInstance.verticalTextBoxStartIndex,
                symbolInstance.verticalTextBoxEndIndex,
                symbolInstance.iconBoxStartIndex,
                symbolInstance.iconBoxEndIndex,
                symbolInstance.verticalIconBoxStartIndex,
                symbolInstance.verticalIconBoxEndIndex
            ));
        }
    }

    hasTextData(): boolean {
        return this.text.segments.get().length > 0;
    }

    hasIconData(): boolean {
        return this.icon.segments.get().length > 0;
    }

    hasDebugData(): CollisionBuffers {
        return this.textCollisionBox && this.iconCollisionBox;
    }

    hasTextCollisionBoxData(): boolean {
        return this.hasDebugData() && this.textCollisionBox.segments.get().length > 0;
    }

    hasIconCollisionBoxData(): boolean {
        return this.hasDebugData() && this.iconCollisionBox.segments.get().length > 0;
    }

    hasIconTextFit(): boolean {
        return this.hasAnyIconTextFit;
    }

    addIndicesForPlacedSymbol(iconOrText: SymbolBuffers, placedSymbolIndex: number) {
        const placedSymbol = iconOrText.placedSymbolArray.get(placedSymbolIndex);

        const endIndex = placedSymbol.vertexStartIndex + placedSymbol.numGlyphs * 4;
        for (let vertexIndex = placedSymbol.vertexStartIndex; vertexIndex < endIndex; vertexIndex += 4) {
            iconOrText.indexArray.emplaceBack(vertexIndex, vertexIndex + 1, vertexIndex + 2);
            iconOrText.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
        }
    }

    getSortedSymbolIndexes(angle: number): Array<number> {
        if (this.sortedAngle === angle && this.symbolInstanceIndexes !== undefined) {
            return this.symbolInstanceIndexes;
        }
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const rotatedYs = [];
        const featureIndexes = [];
        const result = [];

        for (let i = 0; i < this.symbolInstances.length; ++i) {
            result.push(i);
            const symbolInstance = this.symbolInstances.get(i);
            rotatedYs.push(Math.round(sin * symbolInstance.tileAnchorX + cos * symbolInstance.tileAnchorY) | 0);
            featureIndexes.push(symbolInstance.featureIndex);
        }

        result.sort((aIndex, bIndex) => (rotatedYs[aIndex] - rotatedYs[bIndex]) || (featureIndexes[bIndex] - featureIndexes[aIndex]));

        return result;
    }

    getSortedIndexesByZOffset(): Array<number> {
        if (!this.zOffsetSortDirty) {
            assert(this.symbolInstanceIndexesSortedZOffset.length === this.symbolInstances.length);
            return this.symbolInstanceIndexesSortedZOffset;
        }
        if (!this.symbolInstanceIndexesSortedZOffset) {
            this.symbolInstanceIndexesSortedZOffset = [];
            for (let i = 0; i < this.symbolInstances.length; ++i) {
                this.symbolInstanceIndexesSortedZOffset.push(i);
            }
        }
        this.zOffsetSortDirty = false;
        return this.symbolInstanceIndexesSortedZOffset.sort((aIndex, bIndex) => this.symbolInstances.get(bIndex).zOffset - this.symbolInstances.get(aIndex).zOffset);
    }

    addToSortKeyRanges(symbolInstanceIndex: number, sortKey: number) {
        const last = this.sortKeyRanges[this.sortKeyRanges.length - 1];
        if (last && last.sortKey === sortKey) {
            last.symbolInstanceEnd = symbolInstanceIndex + 1;
        } else {
            this.sortKeyRanges.push({
                sortKey,
                symbolInstanceStart: symbolInstanceIndex,
                symbolInstanceEnd: symbolInstanceIndex + 1
            });
        }
    }

    sortFeatures(angle: number) {
        if (!this.sortFeaturesByY) return;
        if (this.sortedAngle === angle) return;

        // The current approach to sorting doesn't sort across segments so don't try.
        // Sorting within segments separately seemed not to be worth the complexity.
        if (this.text.segments.get().length > 1 || this.icon.segments.get().length > 1) return;

        // If the symbols are allowed to overlap sort them by their vertical screen position.
        // The index array buffer is rewritten to reference the (unchanged) vertices in the
        // sorted order.

        // To avoid sorting the actual symbolInstance array we sort an array of indexes.
        this.symbolInstanceIndexes = this.getSortedSymbolIndexes(angle);
        this.sortedAngle = angle;

        this.text.indexArray.clear();
        this.icon.indexArray.clear();

        this.featureSortOrder = [];

        for (const i of this.symbolInstanceIndexes) {
            const symbol = this.symbolInstances.get(i);
            this.featureSortOrder.push(symbol.featureIndex);
            const {
                rightJustifiedTextSymbolIndex: right, centerJustifiedTextSymbolIndex: center,
                leftJustifiedTextSymbolIndex: left, verticalPlacedTextSymbolIndex: vertical,
                placedIconSymbolIndex: icon, verticalPlacedIconSymbolIndex: iconVertical
            } = symbol;

            // Only add a given index the first time it shows up, to avoid duplicate
            // opacity entries when multiple justifications share the same glyphs.
            if (right >= 0) this.addIndicesForPlacedSymbol(this.text, right);
            if (center >= 0 && center !== right) this.addIndicesForPlacedSymbol(this.text, center);
            if (left >= 0 && left !== center && left !== right) this.addIndicesForPlacedSymbol(this.text, left);

            if (vertical >= 0) this.addIndicesForPlacedSymbol(this.text, vertical);
            if (icon >= 0) this.addIndicesForPlacedSymbol(this.icon, icon);
            if (iconVertical >= 0) this.addIndicesForPlacedSymbol(this.icon, iconVertical);
        }

        if (this.text.indexBuffer) this.text.indexBuffer.updateData(this.text.indexArray);
        if (this.icon.indexBuffer) this.icon.indexBuffer.updateData(this.icon.indexArray);
    }
}

register(SymbolBucket, 'SymbolBucket', {
    omit: ['layers', 'collisionBoxArray', 'features', 'compareText']
});

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, glyphOffsetArrayStart
// eg the max valid UInt16 is 65,535
// See https://github.com/mapbox/mapbox-gl-js/issues/2907 for motivation
// lineStartIndex and textBoxStartIndex could potentially be concerns
// but we expect there to be many fewer boxes/lines than glyphs
SymbolBucket.MAX_GLYPHS = 65535;

SymbolBucket.addDynamicAttributes = addDynamicAttributes;

export default SymbolBucket;
export {addDynamicAttributes, updateGlobeVertexNormal};
