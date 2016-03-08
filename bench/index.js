'use strict';

try {
    main();
} catch (err) {
    log('red', err.toString());
    throw err;
}

function main() {
    var BENCHMARKS = {
        buffer: require('./buffer_benchmark')
    };

    var benchmarkName = getURLParameter('benchmark');
    if (!benchmarkName) throw new Error('You must provide a "benchmark" url parameter');
    var runBenchmark = BENCHMARKS[benchmarkName];
    if (!runBenchmark) throw new Error('Unknown benchmark "' + benchmarkName + '"');

    var benchmark = runBenchmark({ accessToken: getAccessToken() });

    benchmark.on('log', function(event) {
        log(event.color || 'blue', event.message);
        scrollToBottom();
    });

    benchmark.on('end', function(event) {
        log('green', '<strong class="prose-big">' + event.message + '</strong>');
        scrollToBottom();
    });

    benchmark.on('error', function(event) {
        log('red', event.error);
        scrollToBottom();
    });
}

function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
}

function log(color, message) {
    document.getElementById('log').innerHTML += '<div class="log dark fill-' + color + '"><p>' + message + '</p></div>';
}

function getAccessToken() {
    var accessToken = (
        process.env.MapboxAccessToken ||
        process.env.MAPBOX_ACCESS_TOKEN ||
        getURLParameter('access_token') ||
        localStorage.getItem('accessToken')
    );
    localStorage.setItem('accessToken', accessToken);
    return accessToken;
}

function getURLParameter(name) {
    var regexp = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
    var output = regexp.exec(window.location.href);
    return output && output[1];
}
