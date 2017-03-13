'use strict';

const Point = require('point-geometry');
const ArrayGroup = require('../array_group');
const BufferGroup = require('../buffer_group');
const createVertexArrayType = require('../vertex_array_type');
const createElementArrayType = require('../element_array_type');
const EXTENT = require('../extent');
const Anchor = require('../../symbol/anchor');
const getAnchors = require('../../symbol/get_anchors');
const resolveTokens = require('../../util/token');
const Quads = require('../../symbol/quads');
const Shaping = require('../../symbol/shaping');
const resolveText = require('../../symbol/resolve_text');
const mergeLines = require('../../symbol/mergelines');
const clipLine = require('../../symbol/clip_line');
const util = require('../../util/util');
const scriptDetection = require('../../util/script_detection');
const loadGeometry = require('../load_geometry');
const CollisionFeature = require('../../symbol/collision_feature');
const findPoleOfInaccessibility = require('../../util/find_pole_of_inaccessibility');
const classifyRings = require('../../util/classify_rings');
const VectorTileFeature = require('vector-tile').VectorTileFeature;
const rtlTextPlugin = require('../../source/rtl_text_plugin');

const shapeText = Shaping.shapeText;
const shapeIcon = Shaping.shapeIcon;
const WritingMode = Shaping.WritingMode;
const getGlyphQuads = Quads.getGlyphQuads;
const getIconQuads = Quads.getIconQuads;

const elementArrayType = createElementArrayType();

const layoutVertexArrayType = createVertexArrayType([
    {name: 'a_pos_offset',  components: 4, type: 'Int16'},
    {name: 'a_texture_pos', components: 2, type: 'Uint16'},
    {name: 'a_data',        components: 4, type: 'Uint8'}
]);

const symbolInterfaces = {
    glyph: {
        layoutVertexArrayType: layoutVertexArrayType,
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
        layoutVertexArrayType: layoutVertexArrayType,
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
        layoutVertexArrayType: createVertexArrayType([
            {name: 'a_pos',     components: 2, type: 'Int16'},
            {name: 'a_extrude', components: 2, type: 'Int16'},
            {name: 'a_data',    components: 2, type: 'Uint8'}
        ]),
        elementArrayType: createElementArrayType(2)
    }
};

function addVertex(array, x, y, ox, oy, tx, ty, minzoom, maxzoom, labelminzoom, labelangle) {
    array.emplaceBack(
            // a_pos_offset
            x,
            y,
            Math.round(ox * 64),
            Math.round(oy * 64),

            // a_texture_pos
            tx / 4, // x coordinate of symbol on glyph atlas texture
            ty / 4, // y coordinate of symbol on glyph atlas texture

            // a_data
            (labelminzoom || 0) * 10, // labelminzoom
            labelangle, // labelangle
            (minzoom || 0) * 10, // minzoom
            Math.min(maxzoom || 25, 25) * 10); // maxzoom
}

function addCollisionBoxVertex(layoutVertexArray, point, extrude, maxZoom, placementZoom) {
    return layoutVertexArray.emplaceBack(
        // pos
        point.x,
        point.y,
        // extrude
        Math.round(extrude.x),
        Math.round(extrude.y),
        // data
        maxZoom * 10,
        placementZoom * 10);
}

/*
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
 * 3. SymbolBucket#prepare(stacks, icons) to perform text shaping and layout, populating `this.symbolInstancesArray`, `this.symbolQuadsArray`, and `this.collisionBoxArray`.
 *
 * 4. SymbolBucket#place(collisionTile): taking collisions into account, decide on which labels and icons to actually draw and at which scale, populating the vertex arrays (`this.arrays.glyph`, `this.arrays.icon`) and thus completing the parsing / buffer population process.
 *
 * The reason that `prepare` and `place` are separate methods is that
 * `prepare`, being independent of pitch and orientation, only needs to happen
 * at tile load time, whereas `place` must be invoked on already-loaded tiles
 * when the pitch/orientation are changed. (See `redoPlacement`.)
 *
 */

class SymbolBucket {
    constructor(options) {
        this.collisionBoxArray = options.collisionBoxArray;

        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;
        this.sdfIcons = options.sdfIcons;
        this.iconsNeedLinear = options.iconsNeedLinear;
        this.adjustedTextSize = options.adjustedTextSize;
        this.adjustedIconSize = options.adjustedIconSize;
        this.fontstack = options.fontstack;

        if (options.arrays) {
            this.buffers = {};
            for (const id in options.arrays) {
                if (options.arrays[id]) {
                    this.buffers[id] = new BufferGroup(symbolInterfaces[id], options.layers, options.zoom, options.arrays[id]);
                }
            }
        }
    }

    populate(features, options) {
        const layer = this.layers[0];
        const layout = layer.layout;
        const textFont = layout['text-font'];
        const iconImage = layout['icon-image'];

        const hasText = textFont && (!layer.isLayoutValueFeatureConstant('text-field') || layout['text-field']);
        const hasIcon = iconImage;

        this.features = [];

        if (!hasText && !hasIcon) {
            return;
        }

        const icons = options.iconDependencies;
        const stacks = options.glyphDependencies;
        const stack = stacks[textFont] = stacks[textFont] || {};

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            if (!layer.filter(feature)) {
                continue;
            }

            let text;
            if (hasText) {
                text = resolveText(layer, {zoom: this.zoom}, feature.properties);
                if (rtlTextPlugin.applyArabicShaping) {
                    text = rtlTextPlugin.applyArabicShaping(text);
                }
            }

            let icon;
            if (hasIcon) {
                icon = resolveTokens(feature.properties, iconImage);
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
                type: VectorTileFeature.types[feature.type]
            });

            if (icon) {
                icons[icon] = true;
            }

            if (text) {
                for (let i = 0; i < text.length; i++) {
                    stack[text.charCodeAt(i)] = true;
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
        return this.arrays.icon.isEmpty() &&
            this.arrays.glyph.isEmpty() &&
            this.arrays.collisionBox.isEmpty();
    }

    getPaintPropertyStatistics() {
        const statistics = {};
        for (const layer of this.layers) {
            statistics[layer.id] = util.extend({},
                this.arrays.icon.layerData[layer.id].paintPropertyStatistics,
                this.arrays.glyph.layerData[layer.id].paintPropertyStatistics
            );
        }
        return statistics;
    }

    serialize(transferables) {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            sdfIcons: this.sdfIcons,
            iconsNeedLinear: this.iconsNeedLinear,
            adjustedTextSize: this.adjustedTextSize,
            adjustedIconSize: this.adjustedIconSize,
            fontstack: this.fontstack,
            arrays: util.mapObject(this.arrays, (a) => a.isEmpty() ? null : a.serialize(transferables))
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
        this.arrays = util.mapObject(symbolInterfaces, (programInterface) => {
            return new ArrayGroup(programInterface, this.layers, this.zoom);
        });
    }

    prepare(stacks, icons) {
        this.symbolInstances = [];

        // To reduce the number of labels that jump around when zooming we need
        // to use a text-size value that is the same for all zoom levels.
        // This calculates text-size at a high zoom level so that all tiles can
        // use the same value when calculating anchor positions.
        this.adjustedTextMaxSize = this.layers[0].getLayoutValue('text-size', {zoom: 18});
        this.adjustedTextSize = this.layers[0].getLayoutValue('text-size', {zoom: this.zoom + 1});
        this.adjustedIconMaxSize = this.layers[0].getLayoutValue('icon-size', {zoom: 18});
        this.adjustedIconSize = this.layers[0].getLayoutValue('icon-size', {zoom: this.zoom + 1});

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

        const justify = layout['text-justify'] === 'right' ? 1 :
            layout['text-justify'] === 'left' ? 0 :
            0.5;

        const oneEm = 24;
        const lineHeight = layout['text-line-height'] * oneEm;
        const maxWidth = layout['symbol-placement'] !== 'line' ? layout['text-max-width'] * oneEm : 0;
        const spacing = layout['text-letter-spacing'] * oneEm;
        const textOffset = [layout['text-offset'][0] * oneEm, layout['text-offset'][1] * oneEm];
        const fontstack = this.fontstack = layout['text-font'].join(',');
        const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';

        for (const feature of this.features) {

            let shapedTextOrientations;
            if (feature.text) {
                const allowsVerticalWritingMode = scriptDetection.allowsVerticalWritingMode(feature.text);

                shapedTextOrientations = {
                    [WritingMode.horizontal]: shapeText(feature.text, stacks[fontstack], maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacing, textOffset, oneEm, WritingMode.horizontal),
                    [WritingMode.vertical]: allowsVerticalWritingMode && textAlongLine && shapeText(feature.text, stacks[fontstack], maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacing, textOffset, oneEm, WritingMode.vertical)
                };
            } else {
                shapedTextOrientations = {};
            }

            let shapedIcon;
            if (feature.icon) {
                const image = icons[feature.icon];
                const iconOffset = this.layers[0].getLayoutValue('icon-offset', {zoom: this.zoom}, feature.properties);
                shapedIcon = shapeIcon(image, iconOffset);

                if (image) {
                    if (this.sdfIcons === undefined) {
                        this.sdfIcons = image.sdf;
                    } else if (this.sdfIcons !== image.sdf) {
                        util.warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                    }
                    if (image.pixelRatio !== 1) {
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
    }

    addFeature(feature, shapedTextOrientations, shapedIcon) {
        const layout = this.layers[0].layout,
            glyphSize = 24,
            fontScale = this.adjustedTextSize / glyphSize,
            textMaxSize = this.adjustedTextMaxSize !== undefined ? this.adjustedTextMaxSize : this.adjustedTextSize,
            textBoxScale = this.tilePixelRatio * fontScale,
            textMaxBoxScale = this.tilePixelRatio * textMaxSize / glyphSize,
            iconBoxScale = this.tilePixelRatio * this.adjustedIconSize,
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
                textBoxScale, textPadding, textAlongLine,
                iconBoxScale, iconPadding, iconAlongLine, {zoom: this.zoom}, feature.properties);
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

    anchorIsTooClose(text, repeatDistance, anchor) {
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

    place(collisionTile, showCollisionBoxes) {
        // Calculate which labels can be shown and when they can be shown and
        // create the bufers used for rendering.

        this.createArrays();

        const layout = this.layers[0].layout;

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

            if (hasText) {
                collisionTile.insertCollisionFeature(textCollisionFeature, glyphScale, layout['text-ignore-placement']);
                if (glyphScale <= maxScale) {
                    this.addSymbols(this.arrays.glyph, symbolInstance.glyphQuads, glyphScale, layout['text-keep-upright'], textAlongLine, collisionTile.angle, symbolInstance.featureProperties, symbolInstance.writingModes);
                }
            }

            if (hasIcon) {
                collisionTile.insertCollisionFeature(iconCollisionFeature, iconScale, layout['icon-ignore-placement']);
                if (iconScale <= maxScale) {
                    this.addSymbols(this.arrays.icon, symbolInstance.iconQuads, iconScale, layout['icon-keep-upright'], iconAlongLine, collisionTile.angle, symbolInstance.featureProperties);
                }
            }

        }

        if (showCollisionBoxes) this.addToDebugBuffers(collisionTile);
    }

    addSymbols(arrays, quads, scale, keepUpright, alongLine, placementAngle, featureProperties, writingModes) {
        const elementArray = arrays.elementArray;
        const layoutVertexArray = arrays.layoutVertexArray;

        const zoom = this.zoom;
        const placementZoom = Math.max(Math.log(scale) / Math.LN2 + zoom, 0);

        for (const symbol of quads) {
            // drop incorrectly oriented glyphs
            const a = (symbol.anchorAngle + placementAngle + Math.PI) % (Math.PI * 2);
            if (writingModes & WritingMode.vertical) {
                if (alongLine && symbol.writingMode === WritingMode.vertical) {
                    if (keepUpright && alongLine && a <= (Math.PI * 5 / 4) || a > (Math.PI * 7 / 4)) continue;
                } else if (keepUpright && alongLine && a <= (Math.PI * 3 / 4) || a > (Math.PI * 5 / 4)) continue;
            } else if (keepUpright && alongLine && (a <= Math.PI / 2 || a > Math.PI * 3 / 2)) continue;

            const tl = symbol.tl,
                tr = symbol.tr,
                bl = symbol.bl,
                br = symbol.br,
                tex = symbol.tex,
                anchorPoint = symbol.anchorPoint;

            let minZoom = Math.max(zoom + Math.log(symbol.minScale) / Math.LN2, placementZoom);
            const maxZoom = Math.min(zoom + Math.log(symbol.maxScale) / Math.LN2, 25);

            if (maxZoom <= minZoom) continue;

            // Lower min zoom so that while fading out the label it can be shown outside of collision-free zoom levels
            if (minZoom === placementZoom) minZoom = 0;

            // Encode angle of glyph
            const glyphAngle = Math.round((symbol.glyphAngle / (Math.PI * 2)) * 256);

            const segment = arrays.prepareSegment(4);
            const index = segment.vertexLength;

            addVertex(layoutVertexArray, anchorPoint.x, anchorPoint.y, tl.x, tl.y, tex.x, tex.y, minZoom, maxZoom, placementZoom, glyphAngle);
            addVertex(layoutVertexArray, anchorPoint.x, anchorPoint.y, tr.x, tr.y, tex.x + tex.w, tex.y, minZoom, maxZoom, placementZoom, glyphAngle);
            addVertex(layoutVertexArray, anchorPoint.x, anchorPoint.y, bl.x, bl.y, tex.x, tex.y + tex.h, minZoom, maxZoom, placementZoom, glyphAngle);
            addVertex(layoutVertexArray, anchorPoint.x, anchorPoint.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, minZoom, maxZoom, placementZoom, glyphAngle);

            elementArray.emplaceBack(index, index + 1, index + 2);
            elementArray.emplaceBack(index + 1, index + 2, index + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;
        }

        arrays.populatePaintArrays(featureProperties);
    }

    addToDebugBuffers(collisionTile) {
        const arrays = this.arrays.collisionBox;
        const layoutVertexArray = arrays.layoutVertexArray;
        const elementArray = arrays.elementArray;

        const angle = -collisionTile.angle;
        const yStretch = collisionTile.yStretch;

        for (const symbolInstance of this.symbolInstances) {
            symbolInstance.textCollisionFeature = {boxStartIndex: symbolInstance.textBoxStartIndex, boxEndIndex: symbolInstance.textBoxEndIndex};
            symbolInstance.iconCollisionFeature = {boxStartIndex: symbolInstance.iconBoxStartIndex, boxEndIndex: symbolInstance.iconBoxEndIndex};

            for (let i = 0; i < 2; i++) {
                const feature = symbolInstance[i === 0 ? 'textCollisionFeature' : 'iconCollisionFeature'];
                if (!feature) continue;

                for (let b = feature.boxStartIndex; b < feature.boxEndIndex; b++) {
                    const box = this.collisionBoxArray.get(b);
                    const anchorPoint = box.anchorPoint;

                    const tl = new Point(box.x1, box.y1 * yStretch)._rotate(angle);
                    const tr = new Point(box.x2, box.y1 * yStretch)._rotate(angle);
                    const bl = new Point(box.x1, box.y2 * yStretch)._rotate(angle);
                    const br = new Point(box.x2, box.y2 * yStretch)._rotate(angle);

                    const maxZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.maxScale) / Math.LN2));
                    const placementZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.placementScale) / Math.LN2));

                    const segment = arrays.prepareSegment(4);
                    const index = segment.vertexLength;

                    addCollisionBoxVertex(layoutVertexArray, anchorPoint, tl, maxZoom, placementZoom);
                    addCollisionBoxVertex(layoutVertexArray, anchorPoint, tr, maxZoom, placementZoom);
                    addCollisionBoxVertex(layoutVertexArray, anchorPoint, br, maxZoom, placementZoom);
                    addCollisionBoxVertex(layoutVertexArray, anchorPoint, bl, maxZoom, placementZoom);

                    elementArray.emplaceBack(index, index + 1);
                    elementArray.emplaceBack(index + 1, index + 2);
                    elementArray.emplaceBack(index + 2, index + 3);
                    elementArray.emplaceBack(index + 3, index);

                    segment.vertexLength += 4;
                    segment.primitiveLength += 4;
                }
            }
        }
    }

    addSymbolInstance(anchor, line, shapedTextOrientations, shapedIcon, layer, addToBuffers, collisionBoxArray, featureIndex, sourceLayerIndex, bucketIndex,
        textBoxScale, textPadding, textAlongLine,
        iconBoxScale, iconPadding, iconAlongLine, globalProperties, featureProperties) {

        let textCollisionFeature, iconCollisionFeature;
        let iconQuads = [];
        let glyphQuads = [];
        for (const writingModeString in shapedTextOrientations) {
            const writingMode = parseInt(writingModeString, 10);
            if (!shapedTextOrientations[writingMode]) continue;
            glyphQuads = glyphQuads.concat(addToBuffers ? getGlyphQuads(anchor, shapedTextOrientations[writingMode], textBoxScale, line, layer, textAlongLine) : []);
            textCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedTextOrientations[writingMode], textBoxScale, textPadding, textAlongLine, false);
        }

        const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : this.collisionBoxArray.length;
        const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : this.collisionBoxArray.length;

        if (shapedIcon) {
            iconQuads = addToBuffers ? getIconQuads(anchor, shapedIcon, iconBoxScale, line, layer, iconAlongLine, shapedTextOrientations[WritingMode.horizontal], globalProperties, featureProperties) : [];
            iconCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, iconAlongLine, true);
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
            textBoxStartIndex,
            textBoxEndIndex,
            iconBoxStartIndex,
            iconBoxEndIndex,
            glyphQuads,
            iconQuads,
            anchor,
            featureIndex,
            featureProperties,
            writingModes
        });
    }
}

SymbolBucket.programInterfaces = symbolInterfaces;

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, iconBoxEndIndex and textBoxEndIndex
// eg the max valid UInt16 is 65,535
SymbolBucket.MAX_INSTANCES = 65535;

module.exports = SymbolBucket;
