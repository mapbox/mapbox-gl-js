var console = {};

console.log = console.warn = function() {
    postMessage({ type: 'debug message', data: [].slice.call(arguments) });
};

console._startTimes = {};
console.time = function(n) {
    console._startTimes[n] = (new Date()).getTime();
};

console.timeEnd = function(n) {
    console.log(n + ':', (new Date()).getTime() - console._startTimes[n] + 'ms');
};

module.exports = console;
