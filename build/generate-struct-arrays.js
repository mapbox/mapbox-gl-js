// @flow

/*
 * Generates the following:
 *  - data/array_types.js, which consists of:
 *    - StructArrayLayout_* subclasses, one for each underlying memory layout we need
 *    - Named exports mapping each conceptual array type (e.g., CircleLayoutArray) to its corresponding StructArrayLayout class
 *    - Particular, named StructArray subclasses, when fancy struct accessors are needed (e.g. CollisionBoxArray)
 */

'use strict'; // eslint-disable-line strict

const fs = require('fs');

require = require('@std/esm')(module, {
    cjs: true,
    esm: 'js',
    sourceMap: true
});

const ejs = require('ejs');
const util = require('../src/util/util');
const {createLayout, viewTypes} = require('../src/util/struct_array');

import type {ViewType, StructArrayLayout} from '../src/util/struct_array';

const structArrayLayoutJs = ejs.compile(fs.readFileSync('src/util/struct_array_layout.js.ejs', 'utf8'), {strict: true});
const structArrayJs = ejs.compile(fs.readFileSync('src/util/struct_array.js.ejs', 'utf8'), {strict: true});

const typeAbbreviations = {
    'Int8': 'b',
    'Uint8': 'ub',
    'Int16': 'i',
    'Uint16': 'ui',
    'Int32': 'l',
    'Uint32': 'ul',
    'Float32': 'f'
};

const arraysWithStructAccessors = [];
const arrayTypeEntries = new Set();
const layoutCache = {};

function normalizeMembers(members, usedTypes) {
    return members.map((member) => {
        if (usedTypes && !usedTypes.has(member.type)) {
            usedTypes.add(member.type);
        }

        return util.extend(member, {
            size: sizeOf(member.type),
            view: member.type.toLowerCase()
        });
    });
}

// - If necessary, write the StructArrayLayout_* class for the given layout
// - If `includeStructAccessors`, write the fancy subclass
// - Add an entry for `name` in the array type registry
function createStructArrayType(name: string, layout: StructArrayLayout, includeStructAccessors: boolean = false) {
    const hasAnchorPoint = layout.members.some(m => m.name === 'anchorPointX');

    // create the underlying StructArrayLayout class exists
    const layoutClass = createStructArrayLayoutType(layout);
    const arrayClass = `${camelize(name)}Array`;

    if (includeStructAccessors) {
        const usedTypes = new Set(['Uint8']);
        const members = normalizeMembers(layout.members, usedTypes);
        arraysWithStructAccessors.push({
            arrayClass,
            members,
            size: layout.size,
            usedTypes,
            hasAnchorPoint,
            layoutClass,
            includeStructAccessors
        });
    } else {
        arrayTypeEntries.add(`${layoutClass} as ${arrayClass}`);
    }
}

function createStructArrayLayoutType({members, size, alignment}) {
    const usedTypes = new Set(['Uint8']);
    members = normalizeMembers(members, usedTypes);

    // combine consecutive 'members' with same underlying type, summing their
    // component counts
    if (!alignment || alignment === 1) members = members.reduce((memo, member) => {
        if (memo.length > 0 && memo[memo.length - 1].type === member.type) {
            const last = memo[memo.length - 1];
            return memo.slice(0, -1).concat(util.extend({}, last, {
                components: last.components + member.components,
            }));
        }
        return memo.concat(member);
    }, []);

    const key = `${members.map(m => `${m.components}${typeAbbreviations[m.type]}`).join('')}${size}`;
    const className = `StructArrayLayout${key}`;
    if (!layoutCache[key]) {
        layoutCache[key] = {
            className,
            members,
            size,
            usedTypes
        };
    }

    return className;
}

function sizeOf(type: ViewType): number {
    return viewTypes[type].BYTES_PER_ELEMENT;
}

function camelize (str) {
    return str.replace(/(?:^|[-_])(.)/g, (_, x) => {
        return /^[0-9]$/.test(x) ? _ : x.toUpperCase();
    });
}

global.camelize = camelize;

const posAttributes = require('../src/data/pos_attributes').default;
const rasterBoundsAttributes = require('../src/data/raster_bounds_attributes').default;

createStructArrayType('pos', posAttributes);
createStructArrayType('raster_bounds', rasterBoundsAttributes);

const circleAttributes = require('../src/data/bucket/circle_attributes').default;
const fillAttributes = require('../src/data/bucket/fill_attributes').default;
const fillExtrusionAttributes = require('../src/data/bucket/fill_extrusion_attributes').default ;
const lineAttributes = require('../src/data/bucket/line_attributes').default;

// layout vertex arrays
const layoutAttributes = {
    circle: circleAttributes,
    fill: fillAttributes,
    'fill-extrusion': fillExtrusionAttributes,
    heatmap: circleAttributes,
    line: lineAttributes
};
for (const name in layoutAttributes) {
    createStructArrayType(`${name.replace(/-/g, '_')}_layout`, layoutAttributes[name]);
}

// symbol layer specific arrays
const {
    symbolLayoutAttributes,
    dynamicLayoutAttributes,
    placementOpacityAttributes,
    collisionBox,
    collisionBoxLayout,
    collisionCircleLayout,
    collisionVertexAttributes,
    placement,
    glyphOffset,
    lineVertex
} = require('../src/data/bucket/symbol_attributes');

createStructArrayType(`symbol_layout`, symbolLayoutAttributes);
createStructArrayType(`symbol_dynamic_layout`, dynamicLayoutAttributes);
createStructArrayType(`symbol_opacity`, placementOpacityAttributes);
createStructArrayType('collision_box', collisionBox, true);
createStructArrayType(`collision_box_layout`, collisionBoxLayout);
createStructArrayType(`collision_circle_layout`, collisionCircleLayout);
createStructArrayType(`collision_vertex`, collisionVertexAttributes);
createStructArrayType('placed_symbol', placement, true);
createStructArrayType('glyph_offset', glyphOffset, true);
createStructArrayType('symbol_line_vertex', lineVertex, true);

// feature index array
createStructArrayType('feature_index', createLayout([
    // the index of the feature in the original vectortile
    { type: 'Uint32', name: 'featureIndex' },
    // the source layer the feature appears in
    { type: 'Uint16', name: 'sourceLayerIndex' },
    // the bucket the feature appears in
    { type: 'Uint16', name: 'bucketIndex' }
]), true);

// triangle index array
createStructArrayType('triangle_index', createLayout([
    { type: 'Uint16', name: 'vertices', components: 3 }
]));

// line index array
createStructArrayType('line_index', createLayout([
    { type: 'Uint16', name: 'vertices', components: 2 }
]));

// paint vertex arrays

// used by SourceBinder for float properties
createStructArrayLayoutType(createLayout([{
    name: 'dummy name (unused for StructArrayLayout)',
    type: 'Float32',
    components: 1
}], 4));

// used by SourceBinder for color properties and CompositeBinder for float properties
createStructArrayLayoutType(createLayout([{
    name: 'dummy name (unused for StructArrayLayout)',
    type: 'Float32',
    components: 2
}], 4));

// used by CompositeBinder for color properties
createStructArrayLayoutType(createLayout([{
    name: 'dummy name (unused for StructArrayLayout)',
    type: 'Float32',
    components: 4
}], 4));

const layouts = Object.keys(layoutCache).map(k => layoutCache[k]);

fs.writeFileSync('src/data/array_types.js',
    `// This file is generated. Edit build/generate-struct-arrays.js, then run \`yarn run codegen\`.
// @flow

import assert from 'assert';
import {StructArray} from '../util/struct_array';
import {Struct} from '../util/struct_array';
import {register} from '../util/web_worker_transfer';
import Point from '@mapbox/point-geometry';

${layouts.map(structArrayLayoutJs).join('\n')}

${arraysWithStructAccessors.map(structArrayJs).join('\n')}

export {
    ${layouts.map(layout => layout.className).join(',\n    ')},
    ${[...arrayTypeEntries].join(',\n    ')}
};`);

