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
        return <div style={{paddingTop: 40, width: 370, position: 'fixed'}}>
            <h1 className="space-bottom">Benchmarks</h1>
            <div className="space-bottom small">
                {Object.keys(this.state.results).map(this.renderBenchmarkSummary)}
            </div>
            <a
                    className={[
                        'icon',
                        'clipboard',
                        'button',
                        (this.getStatus() === 'ended' ? '' : 'disabled')
                    ].join(' ')}
                    data-clipboard-text={this.renderBenchmarkTextSummaries()}>
                Copy Results
            </a>
        </div>;
    },

    renderBenchmarkSummary: function(benchmarkName) {
        var results = this.state.results[name];
        var that = this;

        return <div key={benchmarkName} className='space-bottom'>
            <h3 className={[
                this.getBenchmarkStatus(benchmarkName) === 'waiting' ? 'quiet' : ''
            ].join(' ')}>{benchmarkName}</h3>
            {Object.keys(this.state.results[benchmarkName]).map(this.renderBenchmarkTargetSummary.bind(this, benchmarkName))}
        </div>;
    },

    renderBenchmarkTargetSummary: function(benchmarkName, targetName) {
        var results = this.state.results[benchmarkName][targetName];
        var that = this;

        return <div
                onClick={function() {
                    that.scrollToBenchmark(benchmarkName, targetName);
                }}
                style={{cursor: 'pointer'}}
                key={targetName}
                className={results.status === 'waiting' ? 'quiet' : ''}>
            <strong>{targetName}:</strong> {results.message || '...'}
        </div>;
    },

    renderBenchmarkTextSummaries: function() {
        var output = '# Benchmarks\n';
        for (var benchmarkName in this.state.results) {
            output += '\n## ' + benchmarkName + '\n\n';
            for (var targetName in this.state.results[benchmarkName]) {
                var result = this.state.results[benchmarkName][targetName];
                output += '**' + targetName + ':** ' + (result.message || '...') + '\n';
            }
        }
        return output;
    },

    renderBenchmarkDetails: function() {
        return <div style={{width: 590, marginLeft: 320, marginBottom: 60}}>
            {Object.keys(this.state.results).map(this.renderBenchmarkDetail)}
        </div>;
    },

    renderBenchmarkDetail: function(benchmarkName) {
        return <div key={benchmarkName}>
            {Object.keys(this.state.results[benchmarkName]).map(this.renderBenchmarkTargetDetail.bind(this, benchmarkName))}
        </div>;
    },

    renderBenchmarkTargetDetail: function(benchmarkName, targetName) {
        var results = this.state.results[benchmarkName][targetName];
        return (
                <div
                    style={{paddingTop: 40}}
                    id={benchmarkName + targetName}
                    key={targetName}
                    className={results.status === 'waiting' ? 'quiet' : ''}>

                    <h2 className='space-bottom'>{benchmarkName} on {targetName}</h2>
                {results.logs.map(function(log, index) {
                    return <div key={index} className={'pad1 dark fill-' + log.color}>{log.message}</div>;
                })}
            </div>
        );
    },

    scrollToBenchmark: function(benchmarkName, targetName) {
        var duration = 300;
        var startTime = (new Date()).getTime();
        var startYOffset = window.pageYOffset;

        requestAnimationFrame(function frame() {
            var endYOffset = document.getElementById(benchmarkName + targetName).offsetTop;
            var time = (new Date()).getTime();
            var yOffset = Math.min((time - startTime) / duration, 1) * (endYOffset - startYOffset) + startYOffset;
            window.scrollTo(0, yOffset);
            if (time < startTime + duration) requestAnimationFrame(frame);
        });
    },

    getInitialState: function() {
        var results = {};

        for (var benchmarkName in this.props.benchmarks) {
            for (var targetName in this.props.benchmarks[benchmarkName]) {
                if (!this.props.benchmarkFilter || this.props.benchmarkFilter(benchmarkName, targetName)) {
                    results[benchmarkName] = results[benchmarkName] || {};
                    results[benchmarkName][targetName] = {
                        status: 'waiting',
                        logs: []
                    };
                }
            }
        }

        return { results: results };
    },

    componentDidMount: function() {
        var that = this;
        var benchmarks = Object.keys(that.props.benchmarks);

        asyncSeries(Object.keys(that.state.results), function(benchmarkName, callback) {
            asyncSeries(Object.keys(that.state.results[benchmarkName]), function(targetName, callback) {
                that.scrollToBenchmark(benchmarkName, targetName);
                that.runBenchmark(benchmarkName, targetName, callback);
            }, callback);
        });
    },

    runBenchmark: function(benchmarkName, targetName, outerCallback) {
        var that = this;
        var results = this.state.results[benchmarkName][targetName];

        results.status = 'running';
        this.scrollToBenchmark(benchmarkName, targetName);
        log('dark', 'starting');

        var emitter = this.props.benchmarks[benchmarkName][targetName]();

        emitter.on('log', function(event) {
            log(event.color, event.message);

        });

        emitter.on('end', function(event) {
            results.message = event.message;
            results.status = 'ended';
            log('green', event.message);
            callback();

        });

        emitter.on('error', function(event) {
            results.status = 'errored';
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
            setTimeout(outerCallback, 500);
        }
    },

    getBenchmarkTargetStatus: function(benchmarkName, targetName) {
        return this.state.results[benchmarkName][targetName].status;
    },

    getBenchmarkStatus: function(benchmarkName) {
        return reduceStatuses(Object.keys(this.state.results[benchmarkName]).map(function(targetName) {
            return this.getBenchmarkTargetStatus(benchmarkName, targetName);
        }, this));
    },

    getStatus() {
        return reduceStatuses(Object.keys(this.state.results).map(function(benchmarkName) {
            return this.getBenchmarkStatus(benchmarkName);
        }, this));
    }
});

function reduceStatuses(statuses) {
    if (statuses.indexOf('running') !== -1) {
        return 'running';
    } else if (statuses.indexOf('waiting') !== -1) {
        return 'waiting';
    } else {
        return 'ended';
    }
}

var clipboard = new Clipboard('.clipboard');

ReactDOM.render(
    <BenchmarksView
        benchmarks={window.mapboxglBenchmarks}
        benchmarkFilter={function(benchmarkName, targetName) {
            var benchmarkNameFilter = window.location.hash.substr(1);
            return !benchmarkNameFilter || benchmarkName === benchmarkNameFilter;
        }}
    />,
    document.getElementById('benchmarks')
);

function asyncSeries(array, iterator, callback) {
    if (array.length) {
        iterator(array[0], function(err) {
            if (err) callback(err);
            else asyncSeries(array.slice(1), iterator, callback);
        });
    } else {
        callback();
    }
}
