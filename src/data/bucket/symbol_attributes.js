// @flow

import {createLayout} from '../../util/struct_array.js';

export const symbolLayoutAttributes = createLayout([
    {name: 'a_pos_offset',  components: 4, type: 'Int16'},
    {name: 'a_data',        components: 4, type: 'Uint16'},
    {name: 'a_pixeloffset',        components: 4, type: 'Int16'}
], 4);

export const dynamicLayoutAttributes = createLayout([
    {name: 'a_projected_pos', components: 3, type: 'Float32'}
], 4);

export const placementOpacityAttributes = createLayout([
    {name: 'a_fade_opacity', components: 1, type: 'Uint32'}
], 4);

export const collisionVertexAttributes = createLayout([
    {name: 'a_placed', components: 2, type: 'Uint8'},
    {name: 'a_shift', components: 2, type: 'Float32'},
]);

export const collisionVertexAttributesExt = createLayout([
    {name: 'a_size_scale', components: 1, type: 'Float32'},
    {name: 'a_padding', components: 2, type: 'Float32'},
]);

export const collisionBox = createLayout([
    // the box is centered around the anchor point
    {type: 'Int16', name: 'anchorPointX'},
    {type: 'Int16', name: 'anchorPointY'},

    // distances to the edges from the anchor
    {type: 'Float32', name: 'x1'},
    {type: 'Float32', name: 'y1'},
    {type: 'Float32', name: 'x2'},
    {type: 'Float32', name: 'y2'},

    {type: 'Int16', name: 'padding'},

    // the index of the feature in the original vectortile
    {type: 'Uint32', name: 'featureIndex'},
    // the source layer the feature appears in
    {type: 'Uint16', name: 'sourceLayerIndex'},
    // the bucket the feature appears in
    {type: 'Uint16', name: 'bucketIndex'},
]);

export const collisionBoxLayout = createLayout([ // used to render collision boxes for debugging purposes
    {name: 'a_pos',        components: 2, type: 'Int16'},
    {name: 'a_anchor_pos', components: 2, type: 'Int16'},
    {name: 'a_extrude',    components: 2, type: 'Int16'}
], 4);

export const collisionCircleLayout = createLayout([ // used to render collision circles for debugging purposes
    {name: 'a_pos_2f',     components: 2, type: 'Float32'},
    {name: 'a_radius',     components: 1, type: 'Float32'},
    {name: 'a_flags',      components: 2, type: 'Int16'}
], 4);

export const quadTriangle = createLayout([
    {name: 'triangle', components: 3, type: 'Uint16'},
]);

export const placement = createLayout([
    {type: 'Int16', name: 'anchorX'},
    {type: 'Int16', name: 'anchorY'},
    {type: 'Uint16', name: 'glyphStartIndex'},
    {type: 'Uint16', name: 'numGlyphs'},
    {type: 'Uint32', name: 'vertexStartIndex'},
    {type: 'Uint32', name: 'lineStartIndex'},
    {type: 'Uint32', name: 'lineLength'},
    {type: 'Uint16', name: 'segment'},
    {type: 'Uint16', name: 'lowerSize'},
    {type: 'Uint16', name: 'upperSize'},
    {type: 'Float32', name: 'lineOffsetX'},
    {type: 'Float32', name: 'lineOffsetY'},
    {type: 'Uint8', name: 'writingMode'},
    {type: 'Uint8', name: 'placedOrientation'},
    {type: 'Uint8', name: 'hidden'},
    {type: 'Uint32', name: 'crossTileID'},
    {type: 'Int16', name: 'associatedIconIndex'}
]);

export const symbolInstance = createLayout([
    {type: 'Int16', name: 'anchorX'},
    {type: 'Int16', name: 'anchorY'},
    {type: 'Int16', name: 'rightJustifiedTextSymbolIndex'},
    {type: 'Int16', name: 'centerJustifiedTextSymbolIndex'},
    {type: 'Int16', name: 'leftJustifiedTextSymbolIndex'},
    {type: 'Int16', name: 'verticalPlacedTextSymbolIndex'},
    {type: 'Int16', name: 'placedIconSymbolIndex'},
    {type: 'Int16', name: 'verticalPlacedIconSymbolIndex'},
    {type: 'Uint16', name: 'key'},
    {type: 'Uint16', name: 'textBoxStartIndex'},
    {type: 'Uint16', name: 'textBoxEndIndex'},
    {type: 'Uint16', name: 'verticalTextBoxStartIndex'},
    {type: 'Uint16', name: 'verticalTextBoxEndIndex'},
    {type: 'Uint16', name: 'iconBoxStartIndex'},
    {type: 'Uint16', name: 'iconBoxEndIndex'},
    {type: 'Uint16', name: 'verticalIconBoxStartIndex'},
    {type: 'Uint16', name: 'verticalIconBoxEndIndex'},
    {type: 'Uint16', name: 'featureIndex'},
    {type: 'Uint16', name: 'numHorizontalGlyphVertices'},
    {type: 'Uint16', name: 'numVerticalGlyphVertices'},
    {type: 'Uint16', name: 'numIconVertices'},
    {type: 'Uint16', name: 'numVerticalIconVertices'},
    {type: 'Uint16', name: 'useRuntimeCollisionCircles'},
    {type: 'Uint32', name: 'crossTileID'},
    {type: 'Float32', name: 'textBoxScale'},
    {type: 'Float32', components: 2, name: 'textOffset'},
    {type: 'Float32', name: 'collisionCircleDiameter'},
]);

export const glyphOffset = createLayout([
    {type: 'Float32', name: 'offsetX'}
]);

export const lineVertex = createLayout([
    {type: 'Int16', name: 'x'},
    {type: 'Int16', name: 'y'},
    {type: 'Int16', name: 'tileUnitDistanceFromAnchor'}
]);
