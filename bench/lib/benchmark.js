// @flow

// According to https://developer.mozilla.org/en-US/docs/Web/API/Performance/now,
// performance.now() should be accurate to 0.005ms. Set the minimum running
// time for a single measurement at 5ms, so that the error due to timer
// precision is < 0.1%.
const minTimeForMeasurement = 0.005 * 1000;

export type Measurement = {
    iterations: number,
    time: number
};

class Benchmark {
    constructor() {
        this._measureAsync = this._measureAsync.bind(this);
    }

    /**
     * The `setup` method is intended to be overridden by subclasses. It will be called once, prior to
     * running any benchmark iterations, and may set state on `this` which the benchmark later accesses.
     * If the setup involves an asynchronous step, `setup` may return a promise.
     */
    setup(): Promise<void> | void {}

    /**
     * The `bench` method is intended to be overridden by subclasses. It should contain the code to be
     * benchmarked. It may access state on `this` set by the `setup` function (but should not modify this
     * state). It will be called multiple times, the total number to be determined by the harness. If
     * the benchmark involves an asynchronous step, `bench` may return a promise.
     */
    bench(): Promise<void> | void {}

    /**
     * The `teardown` method is intended to be overridden by subclasses. It will be called once, after
     * running all benchmark iterations, and may perform any necessary cleanup. If cleaning up involves
     * an asynchronous step, `teardown` may return a promise.
     */
    teardown(): Promise<void> | void {}

    _measureAsync: () => Promise<Array<Measurement>>;
    _elapsed: number;
    _measurements: Array<Measurement>;
    _iterationsPerMeasurement: number;
    _start: number;

    /**
     * Run the benchmark by executing `setup` once, sampling the execution time of `bench` some number of
     * times, and then executing `teardown`. Yields an array of execution times.
     */
    run(): Promise<?Array<Measurement>> {
        return Promise.resolve(this.setup())
            .then(() => this._begin())
            .catch(e => {
                // The bench run will break here but should at least provide helpful information:
                console.error(e);
            });
    }

    _done() {
        // 210 samples => 20 observations for regression
        return this._elapsed >= 500 && this._measurements.length > 210;
    }

    _begin(): Promise<Array<Measurement>> {
        this._measurements = [];
        this._elapsed = 0;
        this._iterationsPerMeasurement = 1;
        this._start = performance.now();

        const bench = this.bench();
        if (bench instanceof Promise) {
            return bench.then(this._measureAsync);
        } else {
            return (this._measureSync(): any);
        }
    }

    _measureSync() {
        // Avoid Promise overhead for sync benchmarks.
        while (true) {
            const time = performance.now() - this._start;
            this._elapsed += time;
            if (time < minTimeForMeasurement) {
                this._iterationsPerMeasurement++;
            } else {
                this._measurements.push({time, iterations: this._iterationsPerMeasurement});
            }
            if (this._done()) {
                return this._end();
            }
            this._start = performance.now();
            for (let i = this._iterationsPerMeasurement; i > 0; --i) {
                this.bench();
            }
        }
    }

    _measureAsync(): Promise<Array<Measurement>> {
        const time = performance.now() - this._start;
        this._elapsed += time;
        if (time < minTimeForMeasurement) {
            this._iterationsPerMeasurement++;
        } else {
            this._measurements.push({time, iterations: this._iterationsPerMeasurement});
        }
        if (this._done()) {
            return this._end();
        }
        this._start = performance.now();
        return this._runAsync(this._iterationsPerMeasurement).then(this._measureAsync);
    }

    _runAsync(n: number): Promise<void> {
        const bench = ((this.bench(): any): Promise<void>);
        if (n === 1) {
            return bench;
        } else {
            return bench.then(() => this._runAsync(n - 1));
        }
    }

    _end(): Promise<Array<Measurement>> {
        return Promise.resolve(this.teardown()).then(() => this._measurements);
    }
}

module.exports = Benchmark;
