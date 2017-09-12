'use strict';
/*eslint no-unused-vars: ["error", { "varsIgnorePattern": "BenchmarksView|clipboard" }]*/

const Clipboard = require('clipboard');

const BenchmarksView = React.createClass({
    render() {
        return <div style={{width: 960, paddingBottom: window.innerHeight, margin: '0 auto'}}>
            <h1 className="space-bottom">
                Benchmarks
                <a
                    className={[
                        'fr',
                        'icon',
                        'clipboard',
                        'button',
                        (this.getStatus() === 'ended' ? '' : 'disabled')
                    ].join(' ')}
                    data-clipboard-text={this.renderTextBenchmarks()}>
                    Copy Results
                </a>
            </h1>
            <table>
                <thead>
                    <tr>
                        <th>Benchmark</th>
                        {this.versions().map((v) => <th key={v}>{v}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {Object.keys(this.state.results).map(this.renderBenchmark)}
                </tbody>
            </table>
        </div>;
    },

    renderBenchmark(name) {
        return <tr key={name}>
            <th><a href={`#${name}`} onClick={this.reload}>{name}</a></th>
            {Object.keys(this.state.results[name]).map(this.renderBenchmarkVersion.bind(this, name))}
        </tr>;
    },

    renderBenchmarkVersion(name, version) {
        const results = this.state.results[name][version];
        const sampleData = results.regression ? results.regression.map(row => row.join(',')).join('\n') : null;
        return (
            <td id={name + version}
                key={version}
                className={results.status === 'waiting' ? 'quiet' : ''}>
                {results.logs.map((log, index) => {
                    return <div key={index} className={`pad1 dark fill-${log.color}`}>{log.message}</div>;
                })}
                {sampleData ? (
                    <details>
                        <summary className='pad1 dark fill-green'>
                            Sample Data
                            <a className='icon clipboard'
                                data-clipboard-text={sampleData}>Copy</a>
                        </summary>
                        <pre>{sampleData}</pre>
                    </details>
                ) : ''}
            </td>
        );
    },

    versions() {
        const versions = [];
        for (const name in this.state.results) {
            for (const version in this.state.results[name]) {
                if (versions.indexOf(version) < 0) {
                    versions.push(version);
                }
            }
        }
        return versions;
    },

    renderTextBenchmarks() {
        const versions = this.versions();
        let output = `benchmark | ${versions.join(' | ')}\n---`;
        for (let i = 0; i < versions.length; i++) {
            output += ' | ---';
        }
        output += '\n';

        for (const name in this.state.results) {
            output += `**${name}**`;
            for (const version of versions) {
                const result = this.state.results[name][version];
                output += ` | ${result && result.message || 'n\/a'} `;
            }
            output += '\n';
        }
        return output;
    },

    getInitialState() {
        const results = {};

        for (const name in this.props.benchmarks) {
            for (const version in this.props.benchmarks[name]) {
                if (!this.props.benchmarkFilter || this.props.benchmarkFilter(name, version)) {
                    results[name] = results[name] || {};
                    results[name][version] = {
                        status: 'waiting',
                        logs: []
                    };
                }
            }
        }

        return { results };
    },

    componentDidMount() {
        let promise = Promise.resolve();

        for (const name of Object.keys(this.state.results)) {
            for (const version of Object.keys(this.state.results[name])) {
                promise = promise.then(() => {
                    return this.runBenchmark(
                        this.props.benchmarks[name][version],
                        this.state.results[name][version]);
                });
            }
        }

        return promise;
    },

    runBenchmark(benchmark, results) {
        results.status = 'running';

        const log = (color, message) => {
            results.logs.push({
                color: color || 'blue',
                message: message
            });
            this.forceUpdate();
        }

        return benchmark.run()
            .then((res) => {
                results.status = 'ended';
                results.samples = res.samples;
                results.regression = res.regression;
                log('green', res.elapsed);
            })
            .catch((error) => {
                results.status = 'errored';
                log('red', error.message);
            });
    },

    getBenchmarkVersionStatus(name, version) {
        return this.state.results[name][version].status;
    },

    getBenchmarkStatus(name) {
        return reduceStatuses(Object.keys(this.state.results[name]).map((version) => {
            return this.getBenchmarkVersionStatus(name, version);
        }));
    },

    getStatus() {
        return reduceStatuses(Object.keys(this.state.results).map((name) => {
            return this.getBenchmarkStatus(name);
        }));
    },

    reload() {
        location.reload();
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

const clipboard = new Clipboard('.clipboard');

ReactDOM.render(
    <BenchmarksView
        benchmarks={window.mapboxglBenchmarks}
        benchmarkFilter={function(name) {
            const nameFilter = window.location.hash.substr(1);
            return !nameFilter || name === nameFilter;
        }}
    />,
    document.getElementById('benchmarks')
);
