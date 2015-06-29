'use strict';

var isEqual = require('lodash.isequal');

var operations = {
    addLayer: 'addLayer',
    removeLayer: 'removeLayer',
    setPaintProperty: 'setPaintProperty',
    setLayoutProperty: 'setLayoutProperty',
    setFilter: 'setFilter',
    addSource: 'addSource',
    removeSource: 'removeSource',

    // prospective operations
    setStyle: 'setStyle',
    setConstant: 'setConstant',
    setSprite: 'setSprite',
    setGlyphs: 'setGlyphs',
    setTransition: 'setTransition',
    setLayerProperty: 'setLayerProperty'
};

function pluckId(layer) {
    return layer.id;
}
function mapById(group, layer) {
    group[layer.id] = layer;
    return group;
}

function computeConstantChanges(before, after, commands) {
    before = before || {};
    after = after || {};
    var prop;
    for (prop in before) {
        if (!before.hasOwnProperty(prop)) continue;
        if (!isEqual(before[prop], after[prop])) {
            commands.push({ command: operations.setConstant, args: [prop, after[prop]] });
        }
    }
    for (prop in after) {
        if (!after.hasOwnProperty(prop) || before.hasOwnProperty(prop)) continue;
        if (!isEqual(before[prop], after[prop])) {
            commands.push({ command: operations.setConstant, args: [prop, after[prop]] });
        }
    }
}

function computeSourceChanges(before, after, commands) {
    before = before || {};
    after = after || {};

    var sourceId;

    // look for sources to remove
    for (sourceId in before) {
        if (!before.hasOwnProperty(sourceId)) continue;
        if (!after.hasOwnProperty(sourceId)) {
            commands.push({ command: operations.removeSource, args: [sourceId] });
        }
    }

    // look for sources to add/update
    for (sourceId in after) {
        if (!after.hasOwnProperty(sourceId)) continue;
        if (!before.hasOwnProperty(sourceId)) {
            commands.push({ command: operations.addSource, args: [sourceId, after[sourceId]] });
        }
        else if (!isEqual(before[sourceId], after[sourceId])) {
            // no update command, must remove then add
            commands.push({ command: operations.removeSource, args: [sourceId] });
            commands.push({ command: operations.addSource, args: [sourceId, after[sourceId]] });
        }
    }
}

function computeLayerPropertyChanges(before, after, commands, layerId, klass, command) {
    before = before || {};
    after = after || {};

    var prop;

    for (prop in before) {
        if (!before.hasOwnProperty(prop)) continue;
        if (!isEqual(before[prop], after[prop])) {
            commands.push({ command: command, args: [layerId, prop, after[prop], klass] });
        }
    }
    for (prop in after) {
        if (!after.hasOwnProperty(prop) || before.hasOwnProperty(prop)) continue;
        if (!isEqual(before[prop], after[prop])) {
            commands.push({ command: command, args: [layerId, prop, after[prop], klass] });
        }
    }
}

function computeLayerChanges(before, after, commands) {
    before = before || [];
    after = after || [];

    // order of layers by id
    var beforeOrder = before.map(pluckId);
    var afterOrder = after.map(pluckId);

    // index of layer by id
    var beforeIndex = before.reduce(mapById, {});
    var afterIndex = after.reduce(mapById, {});

    // track order of layers as if they have been mutated
    var tracker = beforeOrder.slice();

    // layers that have been added do not need to be diffed
    var clean = Object.create(null);

    var i, d, layerId, insertBeforeLayerId, beforeLayer, afterLayer, prop;

    // remove layers
    for (i = 0, d = 0; i < beforeOrder.length; i++) {
        layerId = beforeOrder[i];
        if (!afterIndex.hasOwnProperty(layerId)) {
            commands.push({ command: operations.removeLayer, args: [layerId] });
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
            commands.push({ command: operations.removeLayer, args: [layerId] });
            tracker.splice(tracker.lastIndexOf(layerId, tracker.length - d), 1);
        } else {
            // limit where in tracker we need to look for a match
            d++;
        }

        // add layer at correct position
        insertBeforeLayerId = tracker[tracker.length - i];
        commands.push({ command: operations.addLayer, args: [afterIndex[layerId], insertBeforeLayerId] });
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

        // layout, paint, filter
        computeLayerPropertyChanges(beforeLayer.layout, afterLayer.layout, commands, layerId, null, operations.setLayoutProperty);
        computeLayerPropertyChanges(beforeLayer.paint, afterLayer.paint, commands, layerId, null, operations.setPaintProperty);
        if (!isEqual(beforeLayer.filter, afterLayer.filter)) {
            commands.push({ command: operations.setFilter, args: [layerId, afterLayer.filter] });
        }

        // handle all other layer props, including paint.*
        for (prop in beforeLayer) {
            if (!beforeLayer.hasOwnProperty(prop)) continue;
            if (prop === 'layout' || prop === 'paint' || prop === 'filter') continue;
            if (prop.indexOf('paint.') === 0) {
                computeLayerPropertyChanges(beforeLayer[prop], afterLayer[prop], commands, layerId, prop.slice(6), operations.setPaintProperty);
            } else if (!isEqual(beforeLayer[prop], afterLayer[prop])) {
                commands.push({ command: operations.setLayerProperty, args: [layerId, prop, afterLayer[prop]] });
            }
        }
        for (prop in afterLayer) {
            if (!afterLayer.hasOwnProperty(prop) || beforeLayer.hasOwnProperty(prop)) continue;
            if (prop === 'layout' || prop === 'paint' || prop === 'filter') continue;
            if (prop.indexOf('paint.') === 0) {
                computeLayerPropertyChanges(beforeLayer[prop], afterLayer[prop], commands, layerId, prop.slice(6), operations.setPaintProperty);
            } else if (!isEqual(beforeLayer[prop], afterLayer[prop])) {
                commands.push({ command: operations.setLayerProperty, args: [layerId, prop, afterLayer[prop]] });
            }
        }
    }
}

function computeStyleChanges(before, after) {
    after = after || {};
    if (!before) return [{ command: operations.setStyle, args: [after] }];

    var commands = [];

    try {
        if (!isEqual(before.sprite, after.sprite)) {
            commands.push({ command: operations.setSprite, args: [after.sprite] });
        }
        if (!isEqual(before.glyphs, after.glyphs)) {
            commands.push({ command: operations.setGlyphs, args: [after.glyphs] });
        }
        if (!isEqual(before.transition, after.transition)) {
            commands.push({ command: operations.setTransition, args: [after.transition] });
        }
        computeConstantChanges(before.constants, after.constants, commands);
        computeSourceChanges(before.sources, after.sources, commands);
        computeLayerChanges(before.layers, after.layers, commands);
    } catch (e) {
        // fall back to setStyle
        console.warn('Unable to compute style diff:', e);
        commands = [{ command: operations.setStyle, args: [after] }];
    }

    return commands;
}

function applyStyleChanges(style, commands) {
    style.batch(function () {
        for (var i = 0; i < commands.length; i++) {
            switch (commands[i].command) {
                case operations.addLayer:
                    style.addLayer.apply(style, commands[i].args);
                    break;
                case operations.removeLayer:
                    style.removeLayer.apply(style, commands[i].args);
                    break;
                case operations.setPaintProperty:
                    style.setPaintProperty.apply(style, commands[i].args);
                    break;
                case operations.setLayoutProperty:
                    style.setLayoutProperty.apply(style, commands[i].args);
                    break;
                case operations.setFilter:
                    style.setFilter.apply(style, commands[i].args);
                    break;
                case operations.addSource:
                    style.addSource.apply(style, commands[i].args);
                    break;
                case operations.removeSource:
                    style.removeSource.apply(style, commands[i].args);
                    break;
                default:
                    throw new Error('Unable to apply command \'' + commands[i].command + '\' to style');
            }
        }
    });

    return style;
}

module.exports = computeStyleChanges;
module.exports.diff = computeStyleChanges;
module.exports.patch = applyStyleChanges;
module.exports.operations = operations;
