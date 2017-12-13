# Benchmarks

Benchmarks help us catch performance regressions and improve performance.

## Running Benchmarks

Start the benchmark server

```bash
MAPBOX_ACCESS_TOKEN={YOUR MAPBOX ACCESS TOKEN} yarn start
```

To run all benchmarks, open [the benchmark page, `http://localhost:9966/bench`](http://localhost:9966/bench).

To run a specific benchmark, add its name to the url hash, for example [`http://localhost:9966/bench/#Layout`](http://localhost:9966/bench/#Layout).

In either case, if you want to run only benchmarks from your local branch, without also running the current master branch build, then include a `no-master` query parameter, i.e. [localhost:9966/bench?no-master](http://localhost:9966/bench?no-master) or [localhost:9966/bench?no-master#Layout](http://localhost:9966/bench?no-master#Layout).

## Writing a Benchmark

Good benchmarks

 - are precise (i.e. running it multiple times returns roughly the same result)
 - operate in a way that mimics real-world usage
 - use a significant quantity of real-world data
 - are conceptually simple

Benchmarks are implemented by extending the `Benchmark` class and implementing at least the `bench` method.
If the benchmark needs to do setup or teardown work that should not be included in the measured time, you
can implement the `setup` or `teardown` methods. All three of these methods may return a `Promise` if they
need to do asynchronous work (or they can act synchronously and return `undefined`).

See the JSDoc comments on the `Benchmark` class for more details, and the existing benchmarks for examples.

## Interpreting benchmark results

The benchmark harness runs each benchmark's `bench` method a lot of times -- until it thinks it has enough
samples to do an analysis -- and records how long each call takes. From these samples, it creates summary
statistics and plots that help in determining whether a given change increased or decreased performance.

* **Mean**, **Minimum**, and **Deviation** are the standard summary statistics.
* **R? Slope / Correlation** are measures derived from comparing increasingly large groups of samples (1 sample,
2 samples, 3 samples, ...) to the sum of those samples' execution time. Ideally, the number of samples is
perfectly linearly correlated to the sum of execution times. If it is, then the slope of the line is equivalent
the average execution time. But usually, the correlation is not perfect due to natural variance and outliers.
The R? correlation indicates how good the linear approximation is. Values greater than 0.99 are good. Less
than 0.99 is iffy (??), and less than 0.90 means something is confounding the results, and they should be
regarded as unreliable (??).
* The top plot shows the distribution of samples, both by plotting each individual sample (on the right),
and by plotting a kernel density estimate. On the right, you can also see (from left to right) the mean,
minimum and maximum sample, and sample values at the first quartile, second quartile (median), and third quartile.
* The bottom plot shows the R? analysis and resulting linear approximation.

## Posting benchmark results to PRs

We recommend installing a browser extension that can take full-page snapshots, e.g.
[FireShot](https://chrome.google.com/webstore/detail/take-webpage-screenshots/mcbpblocgmgfnpjjppndjkmgjaogfceg).
