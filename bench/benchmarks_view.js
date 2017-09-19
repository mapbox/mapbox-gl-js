'use strict';

const versionColor = d3.scaleOrdinal(d3.schemeCategory10);
versionColor(0); // Skip blue -- too similar to link color.

class Plot extends React.Component {
    render() {
        return <svg width="100%" ref={node => this.node = node}></svg>;
    }

    componentDidMount() {
        this.plot();
    }

    componentDidUpdate() {
        this.plot();
    }
}

class DensityPlot extends Plot {
    plot() {
        function kernelDensityEstimator(kernel, X) {
            return function(V) {
                return X.map(function(x) {
                    return [x, d3.mean(V, function(v) { return kernel(x - v); })];
                });
            };
        }

        function kernelEpanechnikov(k) {
            return function(v) {
                return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
            };
        }

        const margin = {top: 20, right: 20, bottom: 30, left: 40},
            width = this.node.clientWidth - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        const x = d3.scaleTime()
            .domain(d3.extent(Array.prototype.concat.apply([], this.props.versions.map(version => version.samples))))
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain([0, 0.2])
            .range([height, 0]);

        const svg = d3.select(this.node)
            .attr("height", height + margin.top + margin.bottom)
            .selectAll("g")
            .data([0]);

        const enter = svg.enter()
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        enter
            .append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .append("text")
            .attr("fill", "#000")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("Time");

        enter
            .append("g")
            .call(d3.axisLeft(y).ticks(4, "%"));

        const density = kernelDensityEstimator(kernelEpanechnikov(0.2), x.ticks(50));

        const version = svg.selectAll(".density")
            .data(this.props.versions);

        version.enter().append("path")
            .attr("class", "density")
            .attr("fill", "none")
            .attr("stroke", version => versionColor(version.name))
            .attr("stroke-opacity", 0.7)
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .merge(version)
            .attr("d", version => version.samples.length ? d3.line()
                .curve(d3.curveBasis)
                .x(d => x(d[0]))
                .y(d => y(d[1]))
                (density(version.samples)) : "");
    }
}

function regression(samples) {
    const result = [];
    for (let i = 0, n = 1; i + n < samples.length; i += n, n++) {
        result.push([n, samples.slice(i, i + n).reduce(((sum, sample) => sum + sample), 0)]);
    }
    return result;
}

class RegressionPlot extends Plot {
    plot() {
        const margin = {top: 20, right: 20, bottom: 30, left: 40},
            width = this.node.clientWidth - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        const x = d3.scaleLinear()
            .domain([0, d3.max(this.props.versions.map(version => d3.max(regression(version.samples) || [], d => d[0])))])
            .range([0, width])
            .nice();

        const y = d3.scaleTime()
            .domain([0, d3.max(this.props.versions.map(version => d3.max(regression(version.samples) || [], d => d[1])))])
            .range([height, 0])
            .nice();

        const svg = d3.select(this.node)
            .attr("height", height + margin.top + margin.bottom)
            .selectAll("g")
            .data([0]);

        const enter = svg.enter()
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        enter
            .append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .append("text")
            .attr("fill", "#000")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("Iterations");

        enter
            .append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(y).ticks(4))
            .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Time")

        const version = svg.selectAll(".version")
            .data(this.props.versions);

        version.enter().append("g")
            .attr("class", "version")
            .style("fill", version => versionColor(version.name))
            .style("fill-opacity", 0.7)
            .merge(version)
            .selectAll("circle")
            .data(version => regression(version.samples))
            .enter().append("circle")
            .attr("r", 3.5)
            .attr("cx", d => x(d[0]))
            .attr("cy", d => y(d[1]));
    }
}

class BenchmarkRow extends React.Component {
    render() {
        const ended = this.props.versions.find(version => version.status === 'ended');

        const trs = [
            <tr key={this.props.name}>
                <th rowspan={ended ? 3 : 1}><a href={`#${this.props.name}`} onClick={this.reload}>{this.props.name}</a></th>
                {this.props.versions.map(version => (
                    <td key={version.name} className={version.status === 'waiting' ? 'quiet' : ''}>{version.message}</td>
                ))}
            </tr>
        ];

        if (ended) {
            trs.push(
                <tr key={this.props.name + '-density'}>
                    <td colspan={this.props.versions.length}><DensityPlot versions={this.props.versions}/></td>
                </tr>
            );

            trs.push(
                <tr key={this.props.name + '-regression'}>
                    <td colspan={this.props.versions.length}><RegressionPlot versions={this.props.versions}/></td>
                </tr>
            );
        }

        return trs;
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
                        {this.props.versions.map(version => <th key={version} style={{color: versionColor(version)}}>{version}</th>)}
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
            logs: [],
            samples: []
        };

        benchmark.versions.push(version);

        promise = promise.then(() => {
            version.status = 'running';
            update();

            return window.mapboxglBenchmarks[name][ver].run()
                .then(samples => {
                    version.status = 'ended';
                    version.message = `${d3.mean(samples).toFixed(0)}ms`;
                    version.samples = samples;
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
