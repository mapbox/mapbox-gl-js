'use strict';
/*eslint no-unused-vars: ["error", { "varsIgnorePattern": "BenchmarksView|clipboard" }]*/

var util = require('../js/util/util');
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

        results.state = 'running';
        this.scrollToBenchmark(name);
        this.setState({runningBenchmark: name});
        log('dark', 'starting');

        this.props.benchmarks[name]({
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
            setTimeout(function() {
                that.setState({runningBenchmark: null});
                outerCallback();
            }, 500);
        }
    }
});

var clipboard = new Clipboard('.clipboard');

var benchmarkName = window.location.hash.substr(1);
var filteredBenchmarks;
if (!benchmarkName) {
    filteredBenchmarks = window.mapboxglBenchmarks;
} else {
    filteredBenchmarks = {};
    filteredBenchmarks[benchmarkName] = window.mapboxglBenchmarks[benchmarkName];
}

ReactDOM.render(<BenchmarksView benchmarks={filteredBenchmarks} />, document.getElementById('benchmarks'));
