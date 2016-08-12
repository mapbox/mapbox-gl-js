'use strict';
/*eslint no-unused-vars: ["error", { "varsIgnorePattern": "BenchmarksView|clipboard" }]*/

var util = require('../js/util/util');
var mapboxgl = require('../js/mapbox-gl');
var Clipboard = require('clipboard');

var BenchmarksView = React.createClass({

    render: function() {
        return <div style={{width: 960, paddingBottom: window.innerHeight, margin: '0 auto'}}>
            {this.renderBenchmarkSummaries()}
            {this.renderBenchmarkDetails()}
        </div>;
    },

    renderBenchmarkSummaries: function() {
        return <div className='col4 prose' style={{paddingTop: 40, width: 320, position: 'fixed'}}>
            <h1 className="space-bottom">Benchmarks</h1>
            <div className="space-bottom">
                {Object.keys(this.state.results).map(this.renderBenchmarkSummary)}
            </div>
            <a
                    className={[
                        'icon',
                        'clipboard',
                        'button',
                        (this.state.state === 'ended' ? '' : 'disabled')
                    ].join(' ')}
                    data-clipboard-text={this.renderBenchmarkTextSummaries()}>
                Copy Results
            </a>
        </div>;
    },

    renderBenchmarkSummary: function(name) {
        var results = this.state.results[name];
        var that = this;

        return <div
                onClick={function() {
                    that.scrollToBenchmark(name);
                }}
                style={{cursor: 'pointer'}}
                key={name}
                className={[
                    results.state === 'waiting' ? 'quiet' : ''
                ].join(' ')}>
            <strong>{name}:</strong> {results.message || '...'}
        </div>;
    },

    renderBenchmarkTextSummaries: function() {
        var output = '# Benchmarks\n\n';
        for (var name in this.state.results) {
            var result = this.state.results[name];
            output += '**' + name + ':** ' + (result.message || '...') + '\n';
        }
        return output;
    },

    renderBenchmarkDetails: function() {
        return <div style={{width: 640, marginLeft: 320, marginBottom: 60}}>
            {Object.keys(this.state.results).map(this.renderBenchmarkDetail)}
        </div>;
    },

    renderBenchmarkDetail: function(name) {
        var results = this.state.results[name];
        return (
                <div
                    id={name}
                    key={name}
                    style={{paddingTop: 40}}
                    className={results.state === 'waiting' ? 'quiet' : ''}>

                <h2 className='space-bottom'>"{name}" Benchmark</h2>
                {results.logs.map(function(log, index) {
                    return <div key={index} className={'pad1 dark fill-' + log.color}>{log.message}</div>;
                })}
            </div>
        );
    },

    scrollToBenchmark: function(name) {
        var duration = 300;
        var startTime = (new Date()).getTime();
        var startYOffset = window.pageYOffset;

        requestAnimationFrame(function frame() {
            var endYOffset = document.getElementById(name).offsetTop;
            var time = (new Date()).getTime();
            var yOffset = Math.min((time - startTime) / duration, 1) * (endYOffset - startYOffset) + startYOffset;
            window.scrollTo(0, yOffset);
            if (time < startTime + duration) requestAnimationFrame(frame);
        });
    },

    getInitialState: function() {
        return {
            state: 'waiting',
            runningBenchmark: Object.keys(this.props.benchmarks)[0],
            results: util.mapObject(this.props.benchmarks, function(_, name) {
                return {
                    name: name,
                    state: 'waiting',
                    logs: []
                };
            })
        };
    },

    componentDidMount: function() {
        var that = this;
        var benchmarks = Object.keys(that.props.benchmarks);

        setTimeout(function next() {
            var bench = benchmarks.shift();
            if (!bench) return;
            that.scrollToBenchmark(bench);
            that.runBenchmark(bench, function () {
                that.setState({state: 'ended'});
                next();
            });
        }, 500);
    },

    runBenchmark: function(name, outerCallback) {
        var that = this;
        var results = this.state.results[name];
        var maps = [];

        results.state = 'running';
        this.scrollToBenchmark(name);
        this.setState({runningBenchmark: name});
        log('dark', 'starting');

        this.props.benchmarks[name]({
            accessToken: getAccessToken(),
            createMap: createMap

        }).on('log', function(event) {
            log(event.color, event.message);

        }).on('end', function(event) {
            results.message = event.message;
            results.state = 'ended';
            log('green', event.message);
            callback();

        }).on('error', function(event) {
            results.state = 'errored';
            log('red', event.error);
            callback();
        });

        function log(color, message) {
            results.logs.push({
                color: color || 'blue',
                message: message
            });
            that.forceUpdate();
        }

        function callback() {
            for (var i = 0; i < maps.length; i++) {
                maps[i].remove();
                maps[i].getContainer().remove();
            }
            setTimeout(function() {
                that.setState({runningBenchmark: null});
                outerCallback();
            }, 500);
        }

        function createMap(options) {
            options = util.extend({width: 512, height: 512}, options);

            var element = document.createElement('div');
            element.style.width = options.width + 'px';
            element.style.height = options.height + 'px';
            element.style.margin = '0 auto';
            document.body.appendChild(element);

            var map = new mapboxgl.Map(util.extend({
                container: element,
                style: 'mapbox://styles/mapbox/streets-v9',
                interactive: false
            }, options));
            maps.push(map);

            return map;
        }
    }
});

var benchmarks = {
    'load-multiple-maps': require('./benchmarks/map_load'),
    buffer: require('./benchmarks/buffer'),
    fps: require('./benchmarks/fps'),
    'frame-duration': require('./benchmarks/frame_duration'),
    'query-point': require('./benchmarks/query_point'),
    'query-box': require('./benchmarks/query_box'),
    'geojson-setdata-small': require('./benchmarks/geojson_setdata_small'),
    'geojson-setdata-large': require('./benchmarks/geojson_setdata_large')
};

var filteredBenchmarks = {};
var benchmarkName = window.location.hash.substr(1);
if (!benchmarkName) {
    filteredBenchmarks = benchmarks;
} else {
    filteredBenchmarks[benchmarkName] = benchmarks[benchmarkName];
}

ReactDOM.render(<BenchmarksView benchmarks={filteredBenchmarks} />, document.getElementById('benchmarks'));

var clipboard = new Clipboard('.clipboard');

mapboxgl.accessToken = getAccessToken();

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
    var results = regexp.exec(window.location.href);
    return results && results[1];
}
