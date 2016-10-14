'use strict';

const MapboxGLFunction = require('mapbox-gl-function');

exports.interpolated = function(parameters, specDefault) {
    const inner = MapboxGLFunction.interpolated(parameters, specDefault);
    const outer = function(globalProperties, featureProperties) {
        return inner(globalProperties && globalProperties.zoom, featureProperties || {});
    };
    outer.isFeatureConstant = inner.isFeatureConstant;
    outer.isZoomConstant = inner.isZoomConstant;
    return outer;
};

exports['piecewise-constant'] = function(parameters, specDefault) {
    const inner = MapboxGLFunction['piecewise-constant'](parameters, specDefault);
    const outer = function(globalProperties, featureProperties) {
        return inner(globalProperties && globalProperties.zoom, featureProperties || {});
    };
    outer.isFeatureConstant = inner.isFeatureConstant;
    outer.isZoomConstant = inner.isZoomConstant;
    return outer;
};

exports.isFunctionDefinition = MapboxGLFunction.isFunctionDefinition;
