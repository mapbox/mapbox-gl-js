(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
typeof define === 'function' && define.amd ? define(['exports'], factory) :
(global = global || self, factory(global.metrics = {}));
}(this, (function (exports) { 'use strict';

var suite = {
	"slow-pans": {
	width: 1024,
	height: 1024,
	center: [
		-122.397218,
		37.791459
	],
	zoom: 15,
	style: "mapbox://styles/mapbox/streets-v11",
	operations: [
		[
			"contentLoad"
		],
		[
			"easeTo",
			{
				center: [
					-122.4556,
					37.71272
				],
				duration: 10000
			}
		],
		[
			"idle"
		],
		[
			"easeTo",
			{
				center: [
					-122.459915,
					37.779474
				],
				duration: 10000
			}
		],
		[
			"idle"
		]
	]
}
};

function handleOperation(map, operations, opIndex, doneCb) {
    var operation = operations[opIndex];
    var opName = operation[0];
    //Delegate to special handler if one is available
    if (opName in operationHandlers) {
        operationHandlers[opName](map, operation.slice(1), function () {
            doneCb(opIndex);
        });
    } else {
        map[opName].apply(map, operation.slice(1));
        doneCb(opIndex);
    }
}

var operationHandlers = {
    wait: function wait(map, params, doneCb) {
        var wait = function() {
            if (map.loaded()) {
                doneCb();
            } else {
                map.once('render', wait);
            }
        };
        wait();
    },
    contentLoad: function contentLoad(map, params, doneCb) {
        if (map.contentLoaded()) {
            doneCb();
        } else {
            map.once('content.load', doneCb);
        }
    },
    idle: function idle(map, params, doneCb) {
        var idle = function() {
            if (!map.isMoving()) {
                doneCb();
            } else {
                map.once('render', idle);
            }
        };
        idle();
    }
};

function applyOperations(map, operations, doneCb) {
    // No operations specified, end immediately adn invoke doneCb.
    if (!operations || operations.length === 0) {
        doneCb();
        return;
    }

    // Start recursive chain
    var scheduleNextOperation = function (lastOpIndex) {
        if (lastOpIndex === operations.length - 1) {
            // Stop recusive chain when at the end of the operations
            doneCb();
            return;
        }

        handleOperation(map, operations, ++lastOpIndex, scheduleNextOperation);
    };
    scheduleNextOperation(-1);
}

//      

//Used to warm-up the browser cache for consistent tile-load timings
var NUM_WARMUP_RUNS = 5;

var NUM_ACTUAL_RUNS = 5;

function runMetrics() {
    var suiteList = [];
    for (var runName in suite) {
        suiteList.push(suite[runName]);
    }
    var totalRuns = NUM_WARMUP_RUNS + NUM_ACTUAL_RUNS;
    var currIndex = 0;

    var startRun = function() {
        executeRun(suiteList[0], function (metrics) {
            if (currIndex >= NUM_WARMUP_RUNS) {
                console.log(metrics);
            }

            currIndex++;
            if (currIndex < totalRuns) {
                startRun();
            }
        });
    };
    startRun();
}

function executeRun(options, finishCb) {

    //1. Create and position the container, floating at the top left
    var container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '10px';
    container.style.top = '10px';
    container.style.width = (options.width) + "px";
    container.style.height = (options.height) + "px";
    document.body.appendChild(container);

    var mapOptions = parseOptions(container, options);
    var map = new mapboxgl.Map(mapOptions);
    map.repaint = true;
    applyOperations(map, options.operations, function () {
        var metrics = map.extractPerformanceMetrics();
        map.remove();
        map = null;
        document.body.removeChild(container);
        finishCb(metrics);
    });
}

function parseOptions(container, options) {
    var copy = JSON.parse(JSON.stringify(options));
    delete copy.width;
    delete copy.height;
    delete copy.operations;
    copy.container = container;
    return copy;
}

exports.runMetrics = runMetrics;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0cmljcy1zdWl0ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vdGVzdC9pbnRlZ3JhdGlvbi9saWIvb3BlcmF0aW9uLWhhbmRsZXJzLmpzIiwiLi4vbGliL21ldHJpY3MtaGFybmVzcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBoYW5kbGVPcGVyYXRpb24obWFwLCBvcGVyYXRpb25zLCBvcEluZGV4LCBkb25lQ2IpIHtcbiAgICBjb25zdCBvcGVyYXRpb24gPSBvcGVyYXRpb25zW29wSW5kZXhdO1xuICAgIGNvbnN0IG9wTmFtZSA9IG9wZXJhdGlvblswXTtcbiAgICAvL0RlbGVnYXRlIHRvIHNwZWNpYWwgaGFuZGxlciBpZiBvbmUgaXMgYXZhaWxhYmxlXG4gICAgaWYgKG9wTmFtZSBpbiBvcGVyYXRpb25IYW5kbGVycykge1xuICAgICAgICBvcGVyYXRpb25IYW5kbGVyc1tvcE5hbWVdKG1hcCwgb3BlcmF0aW9uLnNsaWNlKDEpLCAoKSA9PiB7XG4gICAgICAgICAgICBkb25lQ2Iob3BJbmRleCk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hcFtvcE5hbWVdKC4uLm9wZXJhdGlvbi5zbGljZSgxKSk7XG4gICAgICAgIGRvbmVDYihvcEluZGV4KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBvcGVyYXRpb25IYW5kbGVycyA9IHtcbiAgICB3YWl0KG1hcCwgcGFyYW1zLCBkb25lQ2IpIHtcbiAgICAgICAgY29uc3Qgd2FpdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKG1hcC5sb2FkZWQoKSkge1xuICAgICAgICAgICAgICAgIGRvbmVDYigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtYXAub25jZSgncmVuZGVyJywgd2FpdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHdhaXQoKTtcbiAgICB9LFxuICAgIGNvbnRlbnRMb2FkKG1hcCwgcGFyYW1zLCBkb25lQ2IpIHtcbiAgICAgICAgaWYgKG1hcC5jb250ZW50TG9hZGVkKCkpIHtcbiAgICAgICAgICAgIGRvbmVDYigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFwLm9uY2UoJ2NvbnRlbnQubG9hZCcsIGRvbmVDYik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGlkbGUobWFwLCBwYXJhbXMsIGRvbmVDYikge1xuICAgICAgICBjb25zdCBpZGxlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAoIW1hcC5pc01vdmluZygpKSB7XG4gICAgICAgICAgICAgICAgZG9uZUNiKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1hcC5vbmNlKCdyZW5kZXInLCBpZGxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgaWRsZSgpO1xuICAgIH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseU9wZXJhdGlvbnMobWFwLCBvcGVyYXRpb25zLCBkb25lQ2IpIHtcbiAgICAvLyBObyBvcGVyYXRpb25zIHNwZWNpZmllZCwgZW5kIGltbWVkaWF0ZWx5IGFkbiBpbnZva2UgZG9uZUNiLlxuICAgIGlmICghb3BlcmF0aW9ucyB8fCBvcGVyYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBkb25lQ2IoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFN0YXJ0IHJlY3Vyc2l2ZSBjaGFpblxuICAgIGNvbnN0IHNjaGVkdWxlTmV4dE9wZXJhdGlvbiA9IChsYXN0T3BJbmRleCkgPT4ge1xuICAgICAgICBpZiAobGFzdE9wSW5kZXggPT09IG9wZXJhdGlvbnMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgLy8gU3RvcCByZWN1c2l2ZSBjaGFpbiB3aGVuIGF0IHRoZSBlbmQgb2YgdGhlIG9wZXJhdGlvbnNcbiAgICAgICAgICAgIGRvbmVDYigpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFuZGxlT3BlcmF0aW9uKG1hcCwgb3BlcmF0aW9ucywgKytsYXN0T3BJbmRleCwgc2NoZWR1bGVOZXh0T3BlcmF0aW9uKTtcbiAgICB9O1xuICAgIHNjaGVkdWxlTmV4dE9wZXJhdGlvbigtMSk7XG59XG4iLCIvLyBAZmxvd1xuLyogZ2xvYmFsIG1hcGJveGdsOnJlYWRvbmx5ICovXG5pbXBvcnQgc3VpdGUgZnJvbSAnLi4vcGVyZm9ybWFuY2UtbWV0cmljcy9zdWl0ZS5qc29uJztcbmltcG9ydCB7YXBwbHlPcGVyYXRpb25zfSBmcm9tICcuLi8uLi90ZXN0L2ludGVncmF0aW9uL2xpYi9vcGVyYXRpb24taGFuZGxlcnMnO1xuXG4vL1VzZWQgdG8gd2FybS11cCB0aGUgYnJvd3NlciBjYWNoZSBmb3IgY29uc2lzdGVudCB0aWxlLWxvYWQgdGltaW5nc1xuY29uc3QgTlVNX1dBUk1VUF9SVU5TID0gNTtcblxuY29uc3QgTlVNX0FDVFVBTF9SVU5TID0gNTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bk1ldHJpY3MoKSB7XG4gICAgY29uc3Qgc3VpdGVMaXN0ID0gW107XG4gICAgZm9yIChjb25zdCBydW5OYW1lIGluIHN1aXRlKSB7XG4gICAgICAgIHN1aXRlTGlzdC5wdXNoKHN1aXRlW3J1bk5hbWVdKTtcbiAgICB9XG4gICAgY29uc3QgdG90YWxSdW5zID0gTlVNX1dBUk1VUF9SVU5TICsgTlVNX0FDVFVBTF9SVU5TO1xuICAgIGxldCBjdXJySW5kZXggPSAwO1xuXG4gICAgY29uc3Qgc3RhcnRSdW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgZXhlY3V0ZVJ1bihzdWl0ZUxpc3RbMF0sIChtZXRyaWNzKSA9PiB7XG4gICAgICAgICAgICBpZiAoY3VyckluZGV4ID49IE5VTV9XQVJNVVBfUlVOUykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1ldHJpY3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjdXJySW5kZXgrKztcbiAgICAgICAgICAgIGlmIChjdXJySW5kZXggPCB0b3RhbFJ1bnMpIHtcbiAgICAgICAgICAgICAgICBzdGFydFJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHN0YXJ0UnVuKCk7XG59XG5cbmZ1bmN0aW9uIGV4ZWN1dGVSdW4ob3B0aW9ucywgZmluaXNoQ2IpIHtcblxuICAgIC8vMS4gQ3JlYXRlIGFuZCBwb3NpdGlvbiB0aGUgY29udGFpbmVyLCBmbG9hdGluZyBhdCB0aGUgdG9wIGxlZnRcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnO1xuICAgIGNvbnRhaW5lci5zdHlsZS5sZWZ0ID0gJzEwcHgnO1xuICAgIGNvbnRhaW5lci5zdHlsZS50b3AgPSAnMTBweCc7XG4gICAgY29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7b3B0aW9ucy53aWR0aH1weGA7XG4gICAgY29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke29wdGlvbnMuaGVpZ2h0fXB4YDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG5cbiAgICBjb25zdCBtYXBPcHRpb25zID0gcGFyc2VPcHRpb25zKGNvbnRhaW5lciwgb3B0aW9ucyk7XG4gICAgbGV0IG1hcCA9IG5ldyBtYXBib3hnbC5NYXAobWFwT3B0aW9ucyk7XG4gICAgbWFwLnJlcGFpbnQgPSB0cnVlO1xuICAgIGFwcGx5T3BlcmF0aW9ucyhtYXAsIG9wdGlvbnMub3BlcmF0aW9ucywgKCkgPT4ge1xuICAgICAgICBjb25zdCBtZXRyaWNzID0gbWFwLmV4dHJhY3RQZXJmb3JtYW5jZU1ldHJpY3MoKTtcbiAgICAgICAgbWFwLnJlbW92ZSgpO1xuICAgICAgICBtYXAgPSBudWxsO1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGNvbnRhaW5lcik7XG4gICAgICAgIGZpbmlzaENiKG1ldHJpY3MpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBwYXJzZU9wdGlvbnMoY29udGFpbmVyLCBvcHRpb25zKSB7XG4gICAgY29uc3QgY29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3B0aW9ucykpO1xuICAgIGRlbGV0ZSBjb3B5LndpZHRoO1xuICAgIGRlbGV0ZSBjb3B5LmhlaWdodDtcbiAgICBkZWxldGUgY29weS5vcGVyYXRpb25zO1xuICAgIGNvcHkuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgIHJldHVybiBjb3B5O1xufVxuXG4iXSwibmFtZXMiOlsiY29uc3QiLCJsZXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsU0FBUyxlQUFlLENBQUMsR0FBRyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFO0lBQ3ZEQSxJQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdENBLElBQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7SUFFNUIsSUFBSSxNQUFNLElBQUksaUJBQWlCLEVBQUU7UUFDN0IsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGNBQUs7WUFDbEQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ25CLENBQUMsQ0FBQztLQUNOLE1BQU07UUFDSCxHQUFHLENBQUMsTUFBTSxPQUFDLENBQUMsS0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ25CO0NBQ0o7O0FBRUQsQUFBT0EsSUFBTSxpQkFBaUIsR0FBRztJQUM3QixtQkFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFO1FBQ3RCQSxJQUFNLElBQUksR0FBRyxXQUFXO1lBQ3BCLElBQUksR0FBRyxDQUFDLE1BQU0s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
