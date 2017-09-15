'use strict';

class BenchmarkRow extends React.Component {
    render() {
        return (
            <tr>
                <th><a href={`#${this.props.name}`} onClick={this.reload}>{this.props.name}</a></th>
                {this.props.versions.map(version => (
                    <td key={version.name} className={version.status === 'waiting' ? 'quiet' : ''}>{version.message}</td>
                ))}
            </tr>
        );
    }

    reload() {
        location.reload();
    }
}

class BenchmarksTable extends React.Component {
    render() {
        return (
            <table style={{width: 960, margin: '2em auto'}}>
                <caption className="space-bottom1"><h1>Benchmarks</h1></caption>
                <thead>
                    <tr>
                        <th>Benchmark</th>
                        {this.props.versions.map(version => <th key={version}>{version}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {this.props.benchmarks.map(benchmark => <BenchmarkRow key={benchmark.name} {...benchmark}/>)}
                </tbody>
            </table>
        );
    }
}

const versions = window.mapboxglVersions;
const benchmarks = [];
const filter = window.location.hash.substr(1);

let finished = false;
let promise = Promise.resolve();

for (const name in window.mapboxglBenchmarks) {
    if (filter && name !== filter)
        continue;

    const benchmark = { name, versions: [] };
    benchmarks.push(benchmark);

    for (const ver in window.mapboxglBenchmarks[name]) {
        const version = {
            name: ver,
            status: 'waiting',
            logs: []
        };

        benchmark.versions.push(version);

        promise = promise.then(() => {
            version.status = 'running';
            update();

            return window.mapboxglBenchmarks[name][ver].run()
                .then(result => {
                    version.status = 'ended';
                    version.message = result.elapsed;
                    version.samples = result.samples;
                    version.regression = result.regression;
                    update();
                })
                .catch(error => {
                    version.status = 'errored';
                    version.message = error.message;
                    update();
                });
        });
    }
}

promise = promise.then(() => {
    finished = true;
    update();
})

function update() {
    ReactDOM.render(
        <BenchmarksTable versions={versions} benchmarks={benchmarks} finished={finished}/>,
        document.getElementById('benchmarks')
    );
}
