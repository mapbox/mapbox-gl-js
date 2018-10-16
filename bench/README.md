# Benchmarks

Benchmarks help us catch performance regressions and improve performance.

## Running Benchmarks

Start the benchmark server

```bash
MAPBOX_ACCESS_TOKEN={YOUR MAPBOX ACCESS TOKEN} yarn start
```

To run all benchmarks, open [the benchmark page, `http://localhost:9966/bench/versions`](http://localhost:9966/bench/versions).

To run a specific benchmark, add its name to the url hash, for example [`http://localhost:9966/bench/versions#Layout`](http://localhost:9966/bench/versions#Layout).

By default, the benchmark page will compare the local branch against `master` and the latest release. To change this, include one or more `compare` query parameters in the URL: E.g., [localhost:9966/bench/versions?compare=master](http://localhost:9966/bench/versions?compare=master) or [localhost:9966/bench/versions?compare=master#Layout](http://localhost:9966/bench/versions?compare=master#Layout) to compare only to master, or [localhost:9966/bench/versions?compare=v0.44.0&compare=v0.44.1](http://localhost:9966/bench/versions?compare=v0.44.0&compare=v0.44.1) to compare to `v0.44.0` and `v0.44.1` (but not `master`).  Versions available for comparison are: `master` and `vX.Y.Z` for versions >= `v0.41.0`.

## Running Style Benchmarks

Start the benchmark server

```bash
MAPBOX_ACCESS_TOKEN={YOUR MAPBOX ACCESS TOKEN} MAPBOX_STYLE_URL={YOUR STYLES HERE} yarn start
```
Note: `MAPBOX_STYLE_URL` takes a comma-separated list of up to 3 Mapbox style URLs (e.g. `mapbox://styles/mapbox/streets-v10,mapbox://styles/mapbox/streets-v9`)

To run all benchmarks, open [the benchmark page, `http://localhost:9966/bench/styles`](http://localhost:9966/bench/styles).

To run a specific benchmark, add its name to the url hash, for example [`http://localhost:9966/bench/styles#Layout`](http://localhost:9966/bench/styles#Layout).

By default, the style benchmark page will run its benchmarks against `mapbox://styles/mapbox/streets-v10`. `Layout` and `Paint` styles will run one instance of the test for each tile/location in an internal list of tiles. This behavior helps visualize the ways in which a style performs given various conditions present in each tile (CJK text, dense urban areas, rural areas, etc). `QueryBox` and `QueryPoint` use the internal list of tiles but otherwise run the same as their non-style benchmark equivalents. `StyleLayerCreate` and `StyleValidate` are not tile/location dependent and run the same way as their non-style benchmark equivalents. All other benchmark tests from the non-style suite are not used when benchmarking styles.

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
