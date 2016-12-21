'use strict';

var colorSpaces = require('./color_spaces');

function identityFunction(x) {
    return x;
}

function createFunction(parameters, defaultType) {
    var fun;

    if (!isFunctionDefinition(parameters)) {
        fun = function() {
            return parameters;
        };
        fun.isFeatureConstant = true;
        fun.isZoomConstant = true;

    } else {
        var zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
        var featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
        var zoomDependent = zoomAndFeatureDependent || !featureDependent;
        var inputType = parameters.stops && typeof (zoomAndFeatureDependent ? parameters.stops[0][0].property : parameters.stops[0][0]);
        var type = parameters.type || defaultType || (inputType === 'string' ? 'categorical' : 'exponential');

        var innerFun;
        if (type === 'exponential') {
            innerFun = evaluateExponentialFunction;
        } else if (type === 'interval') {
            innerFun = evaluateIntervalFunction;
        } else if (type === 'categorical') {
            innerFun = evaluateCategoricalFunction;
        } else if (type === 'identity') {
            innerFun = evaluateIdentityFunction;
        } else {
            throw new Error('Unknown function type "' + type + '"');
        }

        var outputFunction;

        // If we're interpolating colors in a color system other than RGBA,
        // first translate all stop values to that color system, then interpolate
        // arrays as usual. The `outputFunction` option lets us then translate
        // the result of that interpolation back into RGBA.
        if (parameters.colorSpace && parameters.colorSpace !== 'rgb') {
            if (colorSpaces[parameters.colorSpace]) {
                var colorspace = colorSpaces[parameters.colorSpace];
                // Avoid mutating the parameters value
                parameters = JSON.parse(JSON.stringify(parameters));
                for (var s = 0; s < parameters.stops.length; s++) {
                    parameters.stops[s] = [
                        parameters.stops[s][0],
                        colorspace.forward(parameters.stops[s][1])
                    ];
                }
                outputFunction = colorspace.reverse;
            } else {
                throw new Error('Unknown color space: ' + parameters.colorSpace);
            }
        } else {
            outputFunction = identityFunction;
        }


        // For categorical functions, generate an Object as a hashmap of the stops for fast searching
        if (innerFun === evaluateCategoricalFunction) {
          var hashedStops = Object.create(null);
          for (var i = 0; i < parameters.stops.length; i++) {
            hashedStops[parameters.stops[i][0]] = parameters.stops[i][1];
          }
        }

        if (zoomAndFeatureDependent) {
            var featureFunctions = {};
            var featureFunctionStops = [];
            for (s = 0; s < parameters.stops.length; s++) {
                var stop = parameters.stops[s];
                if (featureFunctions[stop[0].zoom] === undefined) {
                    featureFunctions[stop[0].zoom] = {
                        zoom: stop[0].zoom,
                        type: parameters.type,
                        property: parameters.property,
                        stops: []
                    };
                }
                featureFunctions[stop[0].zoom].stops.push([stop[0].value, stop[1]]);
            }

            for (var z in featureFunctions) {
                featureFunctionStops.push([featureFunctions[z].zoom, createFunction(featureFunctions[z])]);
            }
            fun = function(zoom, feature) {
                return outputFunction(evaluateExponentialFunction({
                  stops: featureFunctionStops,
                  base: parameters.base
                }, zoom)(zoom, feature));
            };
            fun.isFeatureConstant = false;
            fun.isZoomConstant = false;

        } else if (zoomDependent) {
            fun = function(zoom) {
                if (innerFun === evaluateCategoricalFunction) {
                  return outputFunction(innerFun(parameters, zoom, hashedStops));
                }
                else return outputFunction(innerFun(parameters, zoom));
            };
            fun.isFeatureConstant = true;
            fun.isZoomConstant = false;
        } else {
            fun = function(zoom, feature) {
                if (innerFun === evaluateCategoricalFunction) {
                  return outputFunction(innerFun(parameters, feature[parameters.property], hashedStops));
                }
                else return outputFunction(
                  innerFun(parameters, feature[parameters.property]));
            };
            fun.isFeatureConstant = false;
            fun.isZoomConstant = true;
        }
    }

    return fun;
}

function evaluateCategoricalFunction(parameters, input, hashedStops) {
    var value = hashedStops[input];
    if (value === undefined) {
      // If the input is not found, return the first value from the original array by default
      return parameters.stops[0][1];
    }

    return value;
}

function evaluateIntervalFunction(parameters, input) {
    // Edge cases
    var n = parameters.stops.length;
    if (n === 1) return parameters.stops[0][1];
    if (input === undefined || input === null) return parameters.stops[n - 1][1];
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    var index = binarySearchForIndex(parameters.stops, input);

    return parameters.stops[index][1];
}

function evaluateExponentialFunction(parameters, input) {
    var base = parameters.base !== undefined ? parameters.base : 1;

    // Edge cases
    var n = parameters.stops.length;
    if (n === 1) return parameters.stops[0][1];
    if (input === undefined || input === null) return parameters.stops[n - 1][1];
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    var index = binarySearchForIndex(parameters.stops, input);

    return interpolate(
            input,
            base,
            parameters.stops[index][0],
            parameters.stops[index + 1][0],
            parameters.stops[index][1],
            parameters.stops[index + 1][1]
    );
}

function evaluateIdentityFunction(parameters, input) {
    return input;
}

function binarySearchForIndex(stops, input) {
  var n = stops.length;
  var lowerIndex = 0;
  var upperIndex = n - 1;
  var currentIndex = 0;
  var currentValue, upperValue;

  while (lowerIndex <= upperIndex) {
    currentIndex = Math.floor((lowerIndex + upperIndex) / 2);
    currentValue = stops[currentIndex][0];
    upperValue = stops[currentIndex + 1][0];
    if (input >= currentValue && input < upperValue) { // Search complete
      return currentIndex;
    } else if (currentValue < input) {
      lowerIndex = currentIndex + 1;
    } else if (currentValue > input) {
      upperIndex = currentIndex - 1;
    }
  }

  return Math.max(currentIndex - 1, 0);
}

function interpolate(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    if (typeof outputLower === 'function') {
        return function() {
            var evaluatedLower = outputLower.apply(undefined, arguments);
            var evaluatedUpper = outputUpper.apply(undefined, arguments);
            return interpolate(input, base, inputLower, inputUpper, evaluatedLower, evaluatedUpper);
        };
    } else if (outputLower.length) {
        return interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper);
    } else {
        return interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper);
    }
}

function interpolateNumber(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    var difference = inputUpper - inputLower;
    var progress = input - inputLower;

    var ratio;
    if (base === 1) {
        ratio = progress / difference;
    } else {
        ratio = (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }

    return (outputLower * (1 - ratio)) + (outputUpper * ratio);
}

function interpolateArray(input, base, inputLower, inputUpper, outputLower, outputUpper) {
    var output = [];
    for (var i = 0; i < outputLower.length; i++) {
        output[i] = interpolateNumber(input, base, inputLower, inputUpper, outputLower[i], outputUpper[i]);
    }
    return output;
}

function isFunctionDefinition(value) {
    return typeof value === 'object' && (value.stops || value.type === 'identity');
}


module.exports.isFunctionDefinition = isFunctionDefinition;

module.exports.interpolated = function(parameters) {
    return createFunction(parameters, 'exponential');
};

module.exports['piecewise-constant'] = function(parameters) {
    return createFunction(parameters, 'interval');
};
