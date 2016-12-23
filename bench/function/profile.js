'use strict';

var createFunction = require('../../').function.interpolated;

function buildExponentialFunction(stopsCount) {
  // Build an exponential function with a long list of stops
  var stops = [];
  for (var i = 0; i < stopsCount; i++) {
    stops.push([i, i * 2]);
  }

  return createFunction({
      type: 'exponential',
      stops: stops
  });
}

function buildCategoricalFunction(stopsCount, useStrings) {
  // Build a categorical function with a long list of stops
  var stops = [];
  for (var i = 0; i < stopsCount; i++) {
    stops.push([useStrings ? String(i) : i, i * 2]);
  }

  return createFunction({
      type: 'categorical',
      stops: stops
  });
}


function profileExponentialFunction(stops, iterations) {
  var f = buildExponentialFunction(stops);
  console.log("\n\n>>> Evaluating exponential function for " + iterations + " iterations with " + stops + " stops");
  console.log("Only include values within the domain of stops:");
  console.time("Time");
  var value;
  for (var i = 0; i < iterations; i++) {
    value = Math.random() * stops;
    f(value);
  }
  console.timeEnd("Time");

  console.log("Include values outside the domain of stops:");
  console.time("Time");
  for (i = 0; i < iterations; i++) {
    value = Math.random() * (stops * 3) - stops;
    f(value);
  }
  console.timeEnd("Time");
}

function profileCategoricalFunction(stops, iterations) {
  var f = buildCategoricalFunction(stops, true);
  console.log("\n\n>>> Evaluating categorical function for " + iterations + " iterations with " + stops + " stops");
  console.log("Using strings as categories:");
  console.time("Time");
  var value;
  for (var i = 0; i < iterations; i++) {
    value = String(Math.floor(Math.random() * stops));
    f(value);
  }
  console.timeEnd("Time");

  console.log("Using values not included in string  categories:");
  console.time("Time");
  for (i = 0; i < iterations; i++) {
    value = String(Math.floor(Math.random() * stops * 2));
    f(value);
  }
  console.timeEnd("Time");

  f = buildCategoricalFunction(stops, false);
  console.log("Using integers as categories:");
  console.time("Time");
  for (i = 0; i < iterations; i++) {
    value = Math.floor(Math.random() * stops);
    f(value);
  }
  console.timeEnd("Time");

  f = buildCategoricalFunction(stops, false);
  console.log("Using values not included in integer categories:");
  console.time("Time");
  for (i = 0; i < iterations; i++) {
    value = Math.floor(Math.random() * stops * 2);
    f(value);
  }
  console.timeEnd("Time");
}

profileExponentialFunction(10000, 100000);
profileExponentialFunction(100, 100000);
profileExponentialFunction(10, 1000000);

profileCategoricalFunction(10000, 10000);
profileCategoricalFunction(100, 10000);
profileCategoricalFunction(10, 100000);
profileCategoricalFunction(100, 10000);
