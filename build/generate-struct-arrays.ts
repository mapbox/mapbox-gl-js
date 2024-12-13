/*
 * Generates the following:
 *  - data/array_types.js, which consists of:
 *    - StructArrayLayout_* subclasses, one for each underlying memory layout we need
 *    - Named exports mapping each conceptual array type (e.g., CircleLayoutArray) to its corresponding StructArrayLayout class
 *    - Particular, named StructArray subclasses, when fancy struct accessors are needed (e.g. CollisionBoxArray)
 */

'use strict'; // eslint-disable-line strict

import fs from 'fs';
import ejs from 'ejs';
import {extend} from '../src/util/util';
import {createLayout, viewTypes} from '../src/util/struct_array';
import type {ViewType, StructArrayLayout, StructArrayMember} from '../src/util/struct_array';

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

type ArrayWithStructAccessors = {
    arrayClass: string;
    members: StructArrayMember[];
    size: number;
    usedTypes: Set<string>;
    layoutClass: string;
    includeStructAccessors: true;
};

const arraysWithStructAccessors: ArrayWithStructAccessors[] = [];
const arrayTypeEntries = new Set();
const layoutCache: Record<string, any> = {};

function normalizeMembers(members: StructArrayMember[], usedTypes: Set<string | ViewType>): StructArrayMember[] {
    return members.map((member) => {
        if (usedTypes && !usedTypes.has(member.type)) {
            usedTypes.add(member.type);
        }

        return extend(member, {
            size: sizeOf(member.type),
            view: member.type.toLowerCase()
        }) as StructArrayMember;
    });
}

// - If necessary, write the StructArrayLayout_* class for the given layout
// - If `includeStructAccessors`, write the fancy subclass
// - Add an entry for `name` in the array type registry
function createStructArrayType(name: string, layout: StructArrayLayout, includeStructAccessors: boolean = false) {
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
            layoutClass,
            includeStructAccessors
        });
    } else {
        arrayTypeEntries.add(`${layoutClass} as ${arrayClass}`);
    }
}

function createStructArrayLayoutType({
    members,
    size,
    alignment,
}: StructArrayLayout) {
    const usedTypes = new Set(['Uint8']);
    members = normalizeMembers(members, usedTypes);

    // combine consecutive 'members' with same underlying type, summing their
    // component counts
    if (!alignment || alignment === 1) members = members.reduce<Array<any>>((memo, member) => {
        if (memo.length > 0 && memo[memo.length - 1].type === member.type) {
            const last = memo[memo.length - 1];
            return memo.slice(0, -1).concat(extend({}, last, {
                components: last.components + member.components,
            }));
        }
        return memo.concat(member);
    }, []);

    const key = `${members.map(m => `${m.components}${typeAbbreviations[m.type]}`).join('')}${size}`;
    const className = `StructArrayLayout${key}`;
    // Layout alignment to 4 bytes boundaries can be an issue on some set of graphics cards. Particularly AMD.
    if (size % 4 !== 0) { console.warn(`Warning: The layout ${className} is not aligned to 4-bytes boundaries.`); }
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

function camelize (str: string) {
    return str.replace(/(?:^|[-_])(.)/g, (_, x) => {
        return /^[0-9]$/.test(x) ? _ : x.toUpperCase();
    });
}

global.camelize = camelize;

import particleAttributes from '../src/data/particle_attributes';
import posAttributes, {posAttributesGlobeExt} from '../src/data/pos_attributes';
import boundsAttributes from '../src/data/bounds_attributes';

createStructArrayType('pos', posAttributes);
createStructArrayType('pos_globe_ext', posAttributesGlobeExt);
createStructArrayType('raster_bounds', boundsAttributes);

import {circleAttributes, circleGlobeAttributesExt} from '../src/data/bucket/circle_attributes';
import fillAttributes from '../src/data/bucket/fill_attributes';
import {lineLayoutAttributes, lineZOffsetAttributes} from '../src/data/bucket/line_attributes';
import lineAttributesExt from '../src/data/bucket/line_attributes_ext';
import lineAttributesPattern from '../src/data/bucket/line_attributes_pattern';
import patternAttributes from '../src/data/bucket/pattern_attributes';
import dashAttributes from '../src/data/bucket/dash_attributes';
import skyboxAttributes from '../src/render/skybox_attributes';
import {fillExtrusionGroundAttributes, fillExtrusionAttributes, fillExtrusionAttributesExt, centroidAttributes, hiddenByLandmarkAttributes, wallAttributes} from '../src/data/bucket/fill_extrusion_attributes';
import {modelAttributes, color3fAttributes, color4fAttributes, normalAttributes, texcoordAttributes, instanceAttributes, featureAttributes} from '../3d-style/data/model_attributes';

// layout vertex arrays
const layoutAttributes = {
    circle: circleAttributes,
    fill: fillAttributes,
    'fill-extrusion': fillExtrusionAttributes,
    'fill-extrusion-ground': fillExtrusionGroundAttributes,
    heatmap: circleAttributes,
    line: lineLayoutAttributes,
    lineExt: lineAttributesExt,
    linePattern: lineAttributesPattern,
    pattern: patternAttributes,
    dash: dashAttributes
};
for (const name in layoutAttributes) {
    createStructArrayType(`${name.replace(/-/g, '_')}_layout`, layoutAttributes[name]);
}

// Globe extension arrays
createStructArrayType('fill_extrusion_ext', fillExtrusionAttributesExt);

// symbol layer specific arrays
import {
    symbolLayoutAttributes,
    symbolGlobeExtAttributes,
    dynamicLayoutAttributes,
    placementOpacityAttributes,
    iconTransitioningAttributes,
    collisionBox,
    collisionBoxLayout,
    collisionCircleLayout,
    collisionVertexAttributes,
    collisionVertexAttributesExt,
    quadTriangle,
    placement,
    symbolInstance,
    glyphOffset,
    lineVertex,
    zOffsetAttributes
} from '../src/data/bucket/symbol_attributes';

createStructArrayType(`symbol_layout`, symbolLayoutAttributes);
createStructArrayType(`symbol_globe_ext`, symbolGlobeExtAttributes);
createStructArrayType(`symbol_dynamic_layout`, dynamicLayoutAttributes);
createStructArrayType(`symbol_opacity`, placementOpacityAttributes);
createStructArrayType(`symbol_icon_transitioning`, iconTransitioningAttributes);
createStructArrayType('collision_box', collisionBox, true);
createStructArrayType(`collision_box_layout`, collisionBoxLayout);
createStructArrayType(`collision_circle_layout`, collisionCircleLayout);
createStructArrayType(`collision_vertex`, collisionVertexAttributes);
createStructArrayType(`collision_vertex_ext`, collisionVertexAttributesExt);
createStructArrayType(`quad_triangle`, quadTriangle);
createStructArrayType('placed_symbol', placement, true);
createStructArrayType('symbol_instance', symbolInstance, true);
createStructArrayType('glyph_offset', glyphOffset, true);
createStructArrayType('symbol_line_vertex', lineVertex, true);
createStructArrayType('z_offset_vertex', zOffsetAttributes);

import globeAttributes from '../src/terrain/globe_attributes';
import {atmosphereLayout} from '../src/render/atmosphere_attributes';
createStructArrayType('globe_vertex', globeAttributes);
createStructArrayType('atmosphere_vertex', atmosphereLayout);

import {starsLayout} from '../src/render/stars_attributes';
createStructArrayType('stars_vertex', starsLayout);

import {snowLayout} from '../src/precipitation/snow_attributes.js';
createStructArrayType('snow_vertex', snowLayout);

import {rainLayout} from '../src/precipitation/rain_attributes.js';
createStructArrayType('rain_vertex', rainLayout);

import {vignetteLayout} from '../src/precipitation/vignette_attributes.js';
createStructArrayType('vignette_vertex', vignetteLayout);

// feature index array
createStructArrayType('feature_index', createLayout([
    // the index of the feature in the original vectortile
    {type: 'Uint32', name: 'featureIndex'},
    // the source layer the feature appears in
    {type: 'Uint16', name: 'sourceLayerIndex'},
    // the bucket the feature appears in
    {type: 'Uint16', name: 'bucketIndex'},
    // Offset into bucket.layoutVertexArray
    {type: 'Uint16', name: 'layoutVertexArrayOffset'},
]), true);

// triangle index array
createStructArrayType('triangle_index', createLayout([
    {type: 'Uint16', name: 'vertices', components: 3}
]));

// line index array
createStructArrayType('line_index', createLayout([
    {type: 'Uint16', name: 'vertices', components: 2}
]));

// line strip index array
createStructArrayType('line_strip_index', createLayout([
    {type: 'Uint16', name: 'vertices', components: 1}
]));

// line z offset extension
createStructArrayType('line_z_offset_ext', lineZOffsetAttributes);

// skybox vertex array
createStructArrayType(`skybox_vertex`, skyboxAttributes);

// tile bounds vertex array
createStructArrayType(`tile_bounds`, boundsAttributes);

// model attributes
createStructArrayType(`model_layout`, modelAttributes);
createStructArrayType(`color3f_layout`, color3fAttributes);
createStructArrayType(`color4f_layout`, color4fAttributes);
createStructArrayType(`texcoord_layout`, texcoordAttributes);
createStructArrayType(`normal_layout`, normalAttributes);
createStructArrayType(`instance_vertex`, instanceAttributes);
createStructArrayType(`feature_vertex`, featureAttributes);

// particle vertex attribute

createStructArrayType('particle_index_layout', particleAttributes);

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

// Fill extrusion specific array
createStructArrayType(`fill_extrusion_centroid`, centroidAttributes, true);
createStructArrayType(`fill_extrusion_wall`, wallAttributes, true);

// Fill extrusion ground effect specific array
createStructArrayType('fill_extrusion_hidden_by_landmark', hiddenByLandmarkAttributes);

// Globe extension arrays
createStructArrayType('circle_globe_ext', circleGlobeAttributesExt);

const layouts = Object.keys(layoutCache).map(k => layoutCache[k]);

fs.writeFileSync('src/data/array_types.ts',
`// This file is generated. Edit build/generate-struct-arrays.ts, then run \`npm run codegen\`.
/* eslint-disable camelcase */

import assert from 'assert';
import {Struct, StructArray} from '../util/struct_array';
import {register} from '../util/web_worker_transfer';

import type {IStructArrayLayout} from '../util/struct_array';

${layouts.map(structArrayLayoutJs).join('\n')}
${arraysWithStructAccessors.map(structArrayJs).join('\n')}
export {
    ${layouts.map(layout => layout.className).join(',\n    ')},
    ${[...arrayTypeEntries].join(',\n    ')}
};
`);
