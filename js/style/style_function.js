'use strict';

var MapboxGLFunction = require('mapbox-gl-function');

exports.interpolated = function(parameters) {
    var inner = MapboxGLFunction.interpolated(parameters);
    var outer = function(globalProperties, featureProperties) {
        return inner(globalProperties && globalProperties.zoom, featureProperties || {});
    };
    outer.isFeatureConstant = inner.isFeatureConstant;
    outer.isZoomConstant = inner.isZoomConstant;
    return outer;
};

exports['piecewise-constant'] = function(parameters) {
    var inner = MapboxGLFunction['piecewise-constant'](parameters);
    var outer = function(globalProperties, featureProperties) {
        return inner(globalProperties && globalProperties.zoom, featureProperties || {});
    };
    outer.isFeatureConstant = inner.isFeatureConstant;
    outer.isZoomConstant = inner.isZoomConstant;
    return outer;
};

exports.isFunctionDefinition = MapboxGLFunction.isFunctionDefinition;
