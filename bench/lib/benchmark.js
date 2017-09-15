// @flow

'use strict';

export type BenchmarkResult = {
    elapsed: number,
    samples: Array<number>,
    regression: Array<[number, number]>
};

class Benchmark {
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
     * Run the benchmark by executing `setup` once and then sampling the execution time of `bench` some
     * number of times, while collecting performance statistics.
     */
    run(): Promise<BenchmarkResult> {
        let n = 1;

        const result = {
            elapsed: 0,
            samples: [],
            regression: []
        };

        const next = (samples: Array<number>) => {
            const sum = samples.reduce((sum, sample) => sum + sample, 0);

            result.elapsed += sum;
            result.samples = result.samples.concat(samples);
            result.regression.push([n, sum]);

            if (result.elapsed < 5000) {
                n += 1;
                return this.runIterations(n).then(next);
            } else {
                return result;
            }
        }

        return Promise.resolve(this.setup())
            .then(() => this.runIterations(n))
            .then(next);
    }

    runIterations(n: number): Promise<Array<number>> {
        const result = [];

        const next = () => {
            result.push(performance.now() - start);
            if (--n > 0) {
                start = performance.now();
                return Promise.resolve(this.bench()).then(next);
            } else {
                return result;
            }
        }

        let start = performance.now();
        return Promise.resolve(this.bench()).then(next);
    }
}

module.exports = Benchmark;
