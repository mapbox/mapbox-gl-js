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

    renderBenchmarkSummary: function(benchmarkName) {
        var results = this.state.results[name];
        var that = this;

        return <div key={benchmarkName}>
            <h2>{benchmarkName}</h2>
            {Object.keys(this.state.results[benchmarkName]).map(this.renderBenchmarkTargetSummary.bind(this, benchmarkName))}
        </div>;
    },

    renderBenchmarkTargetSummary: function(benchmarkName, targetName) {
        var results = this.state.results[benchmarkName][targetName];
        var that = this;

        return <div
                onClick={function() {
                    that.scrollToBenchmark(benchmakrName, targetName);
                }}
                style={{cursor: 'pointer'}}
                key={targetName}
                className={[
                    results.state === 'waiting' ? 'quiet' : ''
                ].join(' ')}>
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
        return <div style={{width: 640, marginLeft: 320, marginBottom: 60}}>
            {Object.keys(this.state.results).map(this.renderBenchmarkDetail)}
        </div>;
    },

    renderBenchmarkDetail: function(benchmarkName) {
        return <div key={benchmarkName}>
            <h2 className='space-bottom'>"{benchmarkName}" Benchmark</h2>
            {Object.keys(this.state.results[benchmarkName]).map(this.renderBenchmarkTargetDetail.bind(this, benchmarkName))}
        </div>;
    },

    renderBenchmarkTargetDetail: function(benchmarkName, targetName) {
        var results = this.state.results[benchmarkName][targetName];
        return (
                <div
                    id={benchmarkName + targetName}
                    key={targetName}
                    style={{paddingTop: 40}}
                    className={results.state === 'waiting' ? 'quiet' : ''}>

                <h3 className='space-bottom'>{targetName}</h3>
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
        console.log(this.props.benchmarks);

        return {
            state: 'waiting',
            results: util.mapObject(this.props.benchmarks, function(targetBenchmarks, benchmarkName) {
                return util.mapObject(targetBenchmarks, function(benchmark, targetName) {
                    return {
                        state: 'waiting',
                        logs: []
                    };
                });
            })
        };
    },

    componentDidMount: function() {
        var that = this;
        var benchmarks = Object.keys(that.props.benchmarks);

        asyncSeries(Object.keys(that.state.results), function(benchmarkName, callback) {
            asyncSeries(Object.keys(that.state.results[benchmarkName]), function(targetName, callback) {
                that.scrollToBenchmark(benchmarkName, targetName);
                that.runBenchmark(benchmarkName, targetName, callback);
            }, callback);
        }, function() {
            that.setState({state: 'ended'});
        });
    },

    runBenchmark: function(benchmarkName, targetName, outerCallback) {
        var that = this;
        var results = this.state.results[benchmarkName][targetName];

        results.state = 'running';
        this.scrollToBenchmark(benchmarkName, targetName);
        log('dark', 'starting');

        this.props.benchmarks[benchmarkName][targetName]({
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
            setTimeout(outerCallback, 500);
        }
    }
});

var clipboard = new Clipboard('.clipboard');

ReactDOM.render(
    <BenchmarksView
        benchmarks={window.mapboxglBenchmarks}
        benchmarkFilter={function(name) {
            var filterName = window.location.hash.substr(1);
            return !filterName || name === filterName;
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
