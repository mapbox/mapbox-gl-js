// @flow

import isEqual from './util/deep_equal.js';

import type {StyleSpecification, ImportSpecification, SourceSpecification, LayerSpecification} from './types.js';

type Sources = { [string]: SourceSpecification };

type Command = {
    command: string;
    args: Array<any>;
};

export const operations: {[_: string]: string} = {

    /*
     * { command: 'setStyle', args: [stylesheet] }
     */
    setStyle: 'setStyle',

    /*
     * { command: 'addLayer', args: [layer, 'beforeLayerId'] }
     */
    addLayer: 'addLayer',

    /*
     * { command: 'removeLayer', args: ['layerId'] }
     */
    removeLayer: 'removeLayer',

    /*
     * { command: 'setPaintProperty', args: ['layerId', 'prop', value] }
     */
    setPaintProperty: 'setPaintProperty',

    /*
     * { command: 'setLayoutProperty', args: ['layerId', 'prop', value] }
     */
    setLayoutProperty: 'setLayoutProperty',

    /*
     * { command: 'setSlot', args: ['layerId', slot] }
     */
    setSlot: 'setSlot',

    /*
     * { command: 'setFilter', args: ['layerId', filter] }
     */
    setFilter: 'setFilter',

    /*
     * { command: 'addSource', args: ['sourceId', source] }
     */
    addSource: 'addSource',

    /*
     * { command: 'removeSource', args: ['sourceId'] }
     */
    removeSource: 'removeSource',

    /*
     * { command: 'setGeoJSONSourceData', args: ['sourceId', data] }
     */
    setGeoJSONSourceData: 'setGeoJSONSourceData',

    /*
     * { command: 'setLayerZoomRange', args: ['layerId', 0, 22] }
     */
    setLayerZoomRange: 'setLayerZoomRange',

    /*
     * { command: 'setLayerProperty', args: ['layerId', 'prop', value] }
     */
    setLayerProperty: 'setLayerProperty',

    /*
     * { command: 'setCenter', args: [[lon, lat]] }
     */
    setCenter: 'setCenter',

    /*
     * { command: 'setZoom', args: [zoom] }
     */
    setZoom: 'setZoom',

    /*
     * { command: 'setBearing', args: [bearing] }
     */
    setBearing: 'setBearing',

    /*
     * { command: 'setPitch', args: [pitch] }
     */
    setPitch: 'setPitch',

    /*
     * { command: 'setSprite', args: ['spriteUrl'] }
     */
    setSprite: 'setSprite',

    /*
     * { command: 'setGlyphs', args: ['glyphsUrl'] }
     */
    setGlyphs: 'setGlyphs',

    /*
     * { command: 'setTransition', args: [transition] }
     */
    setTransition: 'setTransition',

    /*
     * { command: 'setLighting', args: [lightProperties] }
     */
    setLight: 'setLight',

    /*
     * { command: 'setTerrain', args: [terrainProperties] }
     */
    setTerrain: 'setTerrain',

    /*
     *  { command: 'setFog', args: [fogProperties] }
     */
    setFog: 'setFog',

    /*
     *  { command: 'setCamera', args: [cameraProperties] }
     */
    setCamera: 'setCamera',

    /*
     *  { command: 'setLights', args: [{light-3d},...] }
     */
    setLights: 'setLights',

    /*
     *  { command: 'setProjection', args: [projectionProperties] }
     */
    setProjection: 'setProjection',

    /*
     *  { command: 'addImport', args: [import] }
     */
    addImport: 'addImport',

    /*
     *  { command: 'removeImport', args: [importId] }
     */
    removeImport: 'removeImport',

    /*
     *  { command: 'setImportUrl', args: [importId, styleUrl] }
     */
    setImportUrl: 'setImportUrl',

    /*
     *  { command: 'setImportData', args: [importId, stylesheet] }
     */
    setImportData: 'setImportData',

    /*
     *  { command: 'setImportConfig', args: [importId, config] }
     */
    setImportConfig: 'setImportConfig'
};

function addSource(sourceId: string, after: Sources, commands: Array<Command>) {
    commands.push({command: operations.addSource, args: [sourceId, after[sourceId]]});
}

function removeSource(sourceId: string, commands: Array<Command>, sourcesRemoved: {[string]: true}) {
    commands.push({command: operations.removeSource, args: [sourceId]});
    sourcesRemoved[sourceId] = true;
}

function updateSource(sourceId: string, after: Sources, commands: Array<Command>, sourcesRemoved: {[string]: true}) {
    removeSource(sourceId, commands, sourcesRemoved);
    addSource(sourceId, after, commands);
}

function canUpdateGeoJSON(before: Sources, after: Sources, sourceId: string) {
    let prop;
    for (prop in before[sourceId]) {
        if (!before[sourceId].hasOwnProperty(prop)) continue;
        if (prop !== 'data' && !isEqual(before[sourceId][prop], after[sourceId][prop])) {
            return false;
        }
    }
    for (prop in after[sourceId]) {
        if (!after[sourceId].hasOwnProperty(prop)) continue;
        if (prop !== 'data' && !isEqual(before[sourceId][prop], after[sourceId][prop])) {
            return false;
        }
    }
    return true;
}

function diffSources(before: Sources, after: Sources, commands: Array<Command>, sourcesRemoved: {[string]: true}) {
    before = before || {};
    after = after || {};

    let sourceId;

    // look for sources to remove
    for (sourceId in before) {
        if (!before.hasOwnProperty(sourceId)) continue;
        if (!after.hasOwnProperty(sourceId)) {
            removeSource(sourceId, commands, sourcesRemoved);
        }
    }

    // look for sources to add/update
    for (sourceId in after) {
        if (!after.hasOwnProperty(sourceId)) continue;
        const source = after[sourceId];
        if (!before.hasOwnProperty(sourceId)) {
            addSource(sourceId, after, commands);
        } else if (!isEqual(before[sourceId], source)) {
            if (before[sourceId].type === 'geojson' && source.type === 'geojson' && canUpdateGeoJSON(before, after, sourceId)) {
                commands.push({command: operations.setGeoJSONSourceData, args: [sourceId, source.data]});
            } else {
                // no update command, must remove then add
                updateSource(sourceId, after, commands, sourcesRemoved);
            }
        }
    }
}

function diffLayerPropertyChanges(before: any, after: any, commands: Array<Command>, layerId: string, klass: ?string, command: string) {
    before = before || {};
    after = after || {};

    let prop;

    for (prop in before) {
        if (!before.hasOwnProperty(prop)) continue;
        if (!isEqual(before[prop], after[prop])) {
            commands.push({command, args: [layerId, prop, after[prop], klass]});
        }
    }
    for (prop in after) {
        if (!after.hasOwnProperty(prop) || before.hasOwnProperty(prop)) continue;
        if (!isEqual(before[prop], after[prop])) {
            commands.push({command, args: [layerId, prop, after[prop], klass]});
        }
    }
}

function pluckId<T: {id: string}>(item: T): string {
    return item.id;
}

function indexById<T: {id: string}>(group: {[string]: T}, item: T): {[id: string]: T} {
    group[item.id] = item;
    return group;
}

function diffLayers(before: Array<LayerSpecification>, after: Array<LayerSpecification>, commands: Array<Command>) {
    before = before || [];
    after = after || [];

    // order of layers by id
    const beforeOrder = before.map(pluckId);
    const afterOrder = after.map(pluckId);

    // index of layer by id
    const beforeIndex = before.reduce(indexById, {});
    const afterIndex = after.reduce(indexById, {});

    // track order of layers as if they have been mutated
    const tracker = beforeOrder.slice();

    // layers that have been added do not need to be diffed
    const clean: Object = Object.create(null);

    let i, d, layerId, beforeLayer: LayerSpecification, afterLayer: LayerSpecification, insertBeforeLayerId, prop;

    // remove layers
    for (i = 0, d = 0; i < beforeOrder.length; i++) {
        layerId = beforeOrder[i];
        if (!afterIndex.hasOwnProperty(layerId)) {
            commands.push({command: operations.removeLayer, args: [layerId]});
            tracker.splice(tracker.indexOf(layerId, d), 1);
        } else {
            // limit where in tracker we need to look for a match
            d++;
        }
    }

    // add/reorder layers
    for (i = 0, d = 0; i < afterOrder.length; i++) {
        // work backwards as insert is before an existing layer
        layerId = afterOrder[afterOrder.length - 1 - i];

        if (tracker[tracker.length - 1 - i] === layerId) continue;

        if (beforeIndex.hasOwnProperty(layerId)) {
            // remove the layer before we insert at the correct position
            commands.push({command: operations.removeLayer, args: [layerId]});
            tracker.splice(tracker.lastIndexOf(layerId, tracker.length - d), 1);
        } else {
            // limit where in tracker we need to look for a match
            d++;
        }

        // add layer at correct position
        insertBeforeLayerId = tracker[tracker.length - i];
        commands.push({command: operations.addLayer, args: [afterIndex[layerId], insertBeforeLayerId]});
        tracker.splice(tracker.length - i, 0, layerId);
        clean[layerId] = true;
    }

    // update layers
    for (i = 0; i < afterOrder.length; i++) {
        layerId = afterOrder[i];
        beforeLayer = beforeIndex[layerId];
        afterLayer = afterIndex[layerId];

        // no need to update if previously added (new or moved)
        if (clean[layerId] || isEqual(beforeLayer, afterLayer)) continue;

        // If source, source-layer, or type have changes, then remove the layer
        // and add it back 'from scratch'.
        // $FlowFixMe[prop-missing] - there is no `source-layer` in background and sky layers
        if (!isEqual(beforeLayer.source, afterLayer.source) || !isEqual(beforeLayer['source-layer'], afterLayer['source-layer']) || !isEqual(beforeLayer.type, afterLayer.type)) {
            commands.push({command: operations.removeLayer, args: [layerId]});
            // we add the layer back at the same position it was already in, so
            // there's no need to update the `tracker`
            insertBeforeLayerId = tracker[tracker.lastIndexOf(layerId) + 1];
            commands.push({command: operations.addLayer, args: [afterLayer, insertBeforeLayerId]});
            continue;
        }

        // layout, paint, filter, minzoom, maxzoom
        diffLayerPropertyChanges(beforeLayer.layout, afterLayer.layout, commands, layerId, null, operations.setLayoutProperty);
        diffLayerPropertyChanges(beforeLayer.paint, afterLayer.paint, commands, layerId, null, operations.setPaintProperty);
        if (!isEqual(beforeLayer.slot, afterLayer.slot)) {
            commands.push({command: operations.setSlot, args: [layerId, afterLayer.slot]});
        }
        if (!isEqual(beforeLayer.filter, afterLayer.filter)) {
            commands.push({command: operations.setFilter, args: [layerId, afterLayer.filter]});
        }
        if (!isEqual(beforeLayer.minzoom, afterLayer.minzoom) || !isEqual(beforeLayer.maxzoom, afterLayer.maxzoom)) {
            commands.push({command: operations.setLayerZoomRange, args: [layerId, afterLayer.minzoom, afterLayer.maxzoom]});
        }

        // handle all other layer props, including paint.*
        for (prop in beforeLayer) {
            if (!beforeLayer.hasOwnProperty(prop)) continue;
            if (prop === 'layout' || prop === 'paint' || prop === 'filter' ||
                prop === 'metadata' || prop === 'minzoom' || prop === 'maxzoom' || prop === 'slot') continue;
            if (prop.indexOf('paint.') === 0) {
                diffLayerPropertyChanges(beforeLayer[prop], afterLayer[prop], commands, layerId, prop.slice(6), operations.setPaintProperty);
            } else if (!isEqual(beforeLayer[prop], afterLayer[prop])) {
                commands.push({command: operations.setLayerProperty, args: [layerId, prop, afterLayer[prop]]});
            }
        }
        for (prop in afterLayer) {
            if (!afterLayer.hasOwnProperty(prop) || beforeLayer.hasOwnProperty(prop)) continue;
            if (prop === 'layout' || prop === 'paint' || prop === 'filter' ||
                prop === 'metadata' || prop === 'minzoom' || prop === 'maxzoom' || prop === 'slot') continue;
            if (prop.indexOf('paint.') === 0) {
                diffLayerPropertyChanges(beforeLayer[prop], afterLayer[prop], commands, layerId, prop.slice(6), operations.setPaintProperty);
            } else if (!isEqual(beforeLayer[prop], afterLayer[prop])) {
                commands.push({command: operations.setLayerProperty, args: [layerId, prop, afterLayer[prop]]});
            }
        }
    }
}

export function diffImports(before: Array<ImportSpecification> = [], after: Array<ImportSpecification> = [], commands: Array<Command>) {
    before = before || [];
    after = after || [];

    // order imports by id
    const beforeOrder = before.map(pluckId);
    const afterOrder = after.map(pluckId);

    // index imports by id
    const beforeIndex = before.reduce(indexById, {});
    const afterIndex = after.reduce(indexById, {});

    // track order of imports as if they have been mutated
    const tracker = beforeOrder.slice();

    let i, d, importId, insertBefore;

    // remove imports
    for (i = 0, d = 0; i < beforeOrder.length; i++) {
        importId = beforeOrder[i];
        if (!afterIndex.hasOwnProperty(importId)) {
            commands.push({command: operations.removeImport, args: [importId]});
            tracker.splice(tracker.indexOf(importId, d), 1);
        } else {
            // limit where in tracker we need to look for a match
            d++;
        }
    }

    // add/reorder imports
    for (i = 0, d = 0; i < afterOrder.length; i++) {
        // work backwards as insert is before an existing import
        importId = afterOrder[afterOrder.length - 1 - i];

        if (tracker[tracker.length - 1 - i] === importId) continue;

        if (beforeIndex.hasOwnProperty(importId)) {
            // remove the import before we insert at the correct position
            commands.push({command: operations.removeImport, args: [importId]});
            tracker.splice(tracker.lastIndexOf(importId, tracker.length - d), 1);
        } else {
            // limit where in tracker we need to look for a match
            d++;
        }

        // add import at correct position
        insertBefore = tracker[tracker.length - i];
        commands.push({command: operations.addImport, args: [afterIndex[importId], insertBefore]});
        tracker.splice(tracker.length - i, 0, importId);
    }

    // update imports
    for (const afterImport of after) {
        const beforeImport = beforeIndex[afterImport.id];
        if (!beforeImport || isEqual(beforeImport, afterImport)) continue;

        if (!isEqual(beforeImport.config, afterImport.config)) {
            commands.push({command: operations.setImportConfig, args: [afterImport.id, afterImport.config]});
        }

        if (!isEqual(beforeImport.url, afterImport.url)) {
            commands.push({command: operations.setImportUrl, args: [afterImport.id, afterImport.url]});
        }

        const beforeData = beforeImport && beforeImport.data;
        const afterData = afterImport.data;

        if (!isEqual(beforeData, afterData)) {
            commands.push({command: operations.setImportData, args: [afterImport.id, afterData]});
        }
    }
}

/**
 * Diff two stylesheet
 *
 * Creates semanticly aware diffs that can easily be applied at runtime.
 * Operations produced by the diff closely resemble the mapbox-gl-js API. Any
 * error creating the diff will fall back to the 'setStyle' operation.
 *
 * Example diff:
 * [
 *     { command: 'setConstant', args: ['@water', '#0000FF'] },
 *     { command: 'setPaintProperty', args: ['background', 'background-color', 'black'] }
 * ]
 *
 * @private
 * @param {*} [before] stylesheet to compare from
 * @param {*} after stylesheet to compare to
 * @returns Array list of changes
 */
export default function diffStyles(before: StyleSpecification, after: StyleSpecification): Array<Command> {
    if (!before) return [{command: operations.setStyle, args: [after]}];

    let commands: Array<Command> = [];

    try {
        // Handle changes to top-level properties
        if (!isEqual(before.version, after.version)) {
            return [{command: operations.setStyle, args: [after]}];
        }
        if (!isEqual(before.center, after.center)) {
            commands.push({command: operations.setCenter, args: [after.center]});
        }
        if (!isEqual(before.zoom, after.zoom)) {
            commands.push({command: operations.setZoom, args: [after.zoom]});
        }
        if (!isEqual(before.bearing, after.bearing)) {
            commands.push({command: operations.setBearing, args: [after.bearing]});
        }
        if (!isEqual(before.pitch, after.pitch)) {
            commands.push({command: operations.setPitch, args: [after.pitch]});
        }
        if (!isEqual(before.sprite, after.sprite)) {
            commands.push({command: operations.setSprite, args: [after.sprite]});
        }
        if (!isEqual(before.glyphs, after.glyphs)) {
            commands.push({command: operations.setGlyphs, args: [after.glyphs]});
        }
        // Handle changes to `imports` before other mergable top-level properties
        if (!isEqual(before.imports, after.imports)) {
            diffImports(before.imports, after.imports, commands);
        }
        if (!isEqual(before.transition, after.transition)) {
            commands.push({command: operations.setTransition, args: [after.transition]});
        }
        if (!isEqual(before.light, after.light)) {
            commands.push({command: operations.setLight, args: [after.light]});
        }
        if (!isEqual(before.fog, after.fog)) {
            commands.push({command: operations.setFog, args: [after.fog]});
        }
        if (!isEqual(before.projection, after.projection)) {
            commands.push({command: operations.setProjection, args: [after.projection]});
        }
        if (!isEqual(before.lights, after.lights)) {
            commands.push({command: operations.setLights, args: [after.lights]});
        }
        if (!isEqual(before.camera, after.camera)) {
            commands.push({command: operations.setCamera, args: [after.camera]});
        }

        // Handle changes to `sources`
        // If a source is to be removed, we also--before the removeSource
        // command--need to remove all the style layers that depend on it.
        const sourcesRemoved = {};

        // First collect the {add,remove}Source commands
        const removeOrAddSourceCommands = [];
        diffSources(before.sources, after.sources, removeOrAddSourceCommands, sourcesRemoved);

        // Push a removeLayer command for each style layer that depends on a
        // source that's being removed.
        // Also, exclude any such layers them from the input to `diffLayers`
        // below, so that diffLayers produces the appropriate `addLayers`
        // command
        const beforeLayers = [];
        if (before.layers) {
            before.layers.forEach((layer) => {
                if (layer.source && sourcesRemoved[layer.source]) {
                    commands.push({command: operations.removeLayer, args: [layer.id]});
                } else {
                    beforeLayers.push(layer);
                }
            });
        }

        // Remove the terrain if the source for that terrain is being removed
        let beforeTerrain = before.terrain;
        if (beforeTerrain) {
            if (sourcesRemoved[beforeTerrain.source]) {
                commands.push({command: operations.setTerrain, args: [undefined]});
                beforeTerrain = undefined;
            }
        }

        commands = commands.concat(removeOrAddSourceCommands);

        // Even though terrain is a top-level property
        // Its like a layer in the sense that it depends on a source being present.
        if (!isEqual(beforeTerrain, after.terrain)) {
            commands.push({command: operations.setTerrain, args: [after.terrain]});
        }

        // Handle changes to `layers`
        diffLayers(beforeLayers, after.layers, commands);
    } catch (e) {
        // fall back to setStyle
        console.warn('Unable to compute style diff:', e);
        commands = [{command: operations.setStyle, args: [after]}];
    }

    return commands;
}
