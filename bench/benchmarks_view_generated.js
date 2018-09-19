(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var Clipboard = require('clipboard');
var benchmarkCooldownTime = 250;
var benchmarkWarmupTime = 250;
var BenchmarksView = React.createClass({
    displayName: 'BenchmarksView',
    render: function () {
        return React.createElement('div', {
            style: {
                width: 960,
                paddingBottom: window.innerHeight,
                margin: '0 auto'
            }
        }, this.renderSidebarBenchmarks(), this.renderBenchmarks());
    },
    renderSidebarBenchmarks: function () {
        return React.createElement('div', {
            style: {
                paddingTop: 40,
                width: 280,
                position: 'fixed'
            },
            className: 'text-right'
        }, React.createElement('h1', { className: 'space-bottom' }, 'Benchmarks'), React.createElement('div', { className: 'space-bottom small' }, Object.keys(this.state.results).map(this.renderSidebarBenchmark)), React.createElement('a', {
            className: [
                'icon',
                'clipboard',
                'button',
                this.getStatus() === 'ended' ? '' : 'disabled'
            ].join(' '),
            'data-clipboard-text': this.renderTextBenchmarks()
        }, 'Copy Results'));
    },
    renderSidebarBenchmark: function (name) {
        return React.createElement('div', {
            key: name,
            className: [
                'space-bottom',
                this.getBenchmarkStatus(name) === 'waiting' ? 'quiet' : ''
            ].join(' ')
        }, React.createElement('h3', null, name), Object.keys(this.state.results[name]).map(this.renderSidebarBenchmarkVersion.bind(this, name)));
    },
    renderSidebarBenchmarkVersion: function (name, version) {
        var results = this.state.results[name][version];
        var that = this;
        return React.createElement('div', {
            onClick: function () {
                that.scrollToBenchmark(name, version);
            },
            style: { cursor: 'pointer' },
            key: version,
            className: results.status === 'waiting' ? 'quiet' : ''
        }, React.createElement('strong', null, version, ':'), ' ', results.message || '...');
    },
    renderTextBenchmarks: function () {
        var output = '# Benchmarks\n';
        for (var name in this.state.results) {
            output += '\n## ' + name + '\n\n';
            for (var version in this.state.results[name]) {
                var result = this.state.results[name][version];
                output += '**' + version + ':** ' + (result.message || '...') + '\n';
            }
        }
        return output;
    },
    renderBenchmarks: function () {
        return React.createElement('div', {
            style: {
                width: 590,
                marginLeft: 320,
                marginBottom: 60
            }
        }, Object.keys(this.state.results).map(this.renderBenchmark));
    },
    renderBenchmark: function (name) {
        return React.createElement('div', { key: name }, Object.keys(this.state.results[name]).map(this.renderBenchmarkVersion.bind(this, name)));
    },
    renderBenchmarkVersion: function (name, version) {
        var results = this.state.results[name][version];
        return React.createElement('div', {
            style: { paddingTop: 40 },
            id: name + version,
            key: version,
            className: results.status === 'waiting' ? 'quiet' : ''
        }, React.createElement('h2', { className: 'space-bottom' }, name, ' on ', version), results.logs.map(function (log, index) {
            return React.createElement('div', {
                key: index,
                className: 'pad1 dark fill-' + log.color
            }, log.message);
        }));
    },
    scrollToBenchmark: function (name, version) {
        var duration = 300;
        var startTime = new Date().getTime();
        var startYOffset = window.pageYOffset;
        requestAnimationFrame(function frame() {
            var endYOffset = document.getElementById(name + version).offsetTop;
            var time = new Date().getTime();
            var yOffset = Math.min((time - startTime) / duration, 1) * (endYOffset - startYOffset) + startYOffset;
            window.scrollTo(0, yOffset);
            if (time < startTime + duration)
                requestAnimationFrame(frame);
        });
    },
    getInitialState: function () {
        var results = {};
        for (var name in this.props.benchmarks) {
            for (var version in this.props.benchmarks[name]) {
                if (!this.props.benchmarkFilter || this.props.benchmarkFilter(name, version)) {
                    results[name] = results[name] || {};
                    results[name][version] = {
                        status: 'waiting',
                        logs: []
                    };
                }
            }
        }
        return { results: results };
    },
    componentDidMount: function () {
        var that = this;
        asyncSeries(Object.keys(that.state.results), function (name, callback) {
            asyncSeries(Object.keys(that.state.results[name]), function (version, callback) {
                that.scrollToBenchmark(name, version);
                that.runBenchmark(name, version, callback);
            }, callback);
        }, function (err) {
            if (err)
                throw err;
        });
    },
    runBenchmark: function (name, version, outerCallback) {
        var that = this;
        var results = this.state.results[name][version];
        function log(color, message) {
            results.logs.push({
                color: color || 'blue',
                message: message
            });
            that.forceUpdate();
        }
        function callback() {
            setTimeout(outerCallback, benchmarkCooldownTime);
        }
        results.status = 'running';
        this.scrollToBenchmark(name, version);
        log('dark', 'starting');
        setTimeout(function () {
            var emitter = that.props.benchmarks[name][version]();
            emitter.on('log', function (event) {
                log(event.color, event.message);
            });
            emitter.on('end', function (event) {
                results.message = event.message;
                results.status = 'ended';
                log('green', event.message);
                callback();
            });
            emitter.on('error', function (event) {
                results.status = 'errored';
                log('red', event.error);
                callback();
            });
        }, benchmarkWarmupTime);
    },
    getBenchmarkVersionStatus: function (name, version) {
        return this.state.results[name][version].status;
    },
    getBenchmarkStatus: function (name) {
        return reduceStatuses(Object.keys(this.state.results[name]).map(function (version) {
            return this.getBenchmarkVersionStatus(name, version);
        }, this));
    },
    getStatus() {
        return reduceStatuses(Object.keys(this.state.results).map(function (name) {
            return this.getBenchmarkStatus(name);
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
ReactDOM.render(React.createElement(BenchmarksView, {
    benchmarks: window.mapboxglBenchmarks,
    benchmarkFilter: function (name) {
        var nameFilter = window.location.hash.substr(1);
        return !nameFilter || name === nameFilter;
    }
}), document.getElementById('benchmarks'));
function asyncSeries(array, iterator, callback) {
    if (array.length) {
        iterator(array[0], function (err) {
            if (err)
                callback(err);
            else
                asyncSeries(array.slice(1), iterator, callback);
        });
    } else {
        callback();
    }
}


},{"clipboard":3}],2:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'select'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('select'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.select);
        global.clipboardAction = mod.exports;
    }
})(this, function (module, _select) {
    'use strict';

    var _select2 = _interopRequireDefault(_select);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
    };

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    var ClipboardAction = function () {
        /**
         * @param {Object} options
         */

        function ClipboardAction(options) {
            _classCallCheck(this, ClipboardAction);

            this.resolveOptions(options);
            this.initSelection();
        }

        /**
         * Defines base properties passed from constructor.
         * @param {Object} options
         */


        ClipboardAction.prototype.resolveOptions = function resolveOptions() {
            var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            this.action = options.action;
            this.emitter = options.emitter;
            this.target = options.target;
            this.text = options.text;
            this.trigger = options.trigger;

            this.selectedText = '';
        };

        ClipboardAction.prototype.initSelection = function initSelection() {
            if (this.text) {
                this.selectFake();
            } else if (this.target) {
                this.selectTarget();
            }
        };

        ClipboardAction.prototype.selectFake = function selectFake() {
            var _this = this;

            var isRTL = document.documentElement.getAttribute('dir') == 'rtl';

            this.removeFake();

            this.fakeHandlerCallback = function () {
                return _this.removeFake();
            };
            this.fakeHandler = document.body.addEventListener('click', this.fakeHandlerCallback) || true;

            this.fakeElem = document.createElement('textarea');
            // Prevent zooming on iOS
            this.fakeElem.style.fontSize = '12pt';
            // Reset box model
            this.fakeElem.style.border = '0';
            this.fakeElem.style.padding = '0';
            this.fakeElem.style.margin = '0';
            // Move element out of screen horizontally
            this.fakeElem.style.position = 'absolute';
            this.fakeElem.style[isRTL ? 'right' : 'left'] = '-9999px';
            // Move element to the same position vertically
            this.fakeElem.style.top = (window.pageYOffset || document.documentElement.scrollTop) + 'px';
            this.fakeElem.setAttribute('readonly', '');
            this.fakeElem.value = this.text;

            document.body.appendChild(this.fakeElem);

            this.selectedText = (0, _select2.default)(this.fakeElem);
            this.copyText();
        };

        ClipboardAction.prototype.removeFake = function removeFake() {
            if (this.fakeHandler) {
                document.body.removeEventListener('click', this.fakeHandlerCallback);
                this.fakeHandler = null;
                this.fakeHandlerCallback = null;
            }

            if (this.fakeElem) {
                document.body.removeChild(this.fakeElem);
                this.fakeElem = null;
            }
        };

        ClipboardAction.prototype.selectTarget = function selectTarget() {
            this.selectedText = (0, _select2.default)(this.target);
            this.copyText();
        };

        ClipboardAction.prototype.copyText = function copyText() {
            var succeeded = undefined;

            try {
                succeeded = document.execCommand(this.action);
            } catch (err) {
                succeeded = false;
            }

            this.handleResult(succeeded);
        };

        ClipboardAction.prototype.handleResult = function handleResult(succeeded) {
            if (succeeded) {
                this.emitter.emit('success', {
                    action: this.action,
                    text: this.selectedText,
                    trigger: this.trigger,
                    clearSelection: this.clearSelection.bind(this)
                });
            } else {
                this.emitter.emit('error', {
                    action: this.action,
                    trigger: this.trigger,
                    clearSelection: this.clearSelection.bind(this)
                });
            }
        };

        ClipboardAction.prototype.clearSelection = function clearSelection() {
            if (this.target) {
                this.target.blur();
            }

            window.getSelection().removeAllRanges();
        };

        ClipboardAction.prototype.destroy = function destroy() {
            this.removeFake();
        };

        _createClass(ClipboardAction, [{
            key: 'action',
            set: function set() {
                var action = arguments.length <= 0 || arguments[0] === undefined ? 'copy' : arguments[0];

                this._action = action;

                if (this._action !== 'copy' && this._action !== 'cut') {
                    throw new Error('Invalid "action" value, use either "copy" or "cut"');
                }
            },
            get: function get() {
                return this._action;
            }
        }, {
            key: 'target',
            set: function set(target) {
                if (target !== undefined) {
                    if (target && (typeof target === 'undefined' ? 'undefined' : _typeof(target)) === 'object' && target.nodeType === 1) {
                        if (this.action === 'copy' && target.hasAttribute('disabled')) {
                            throw new Error('Invalid "target" attribute. Please use "readonly" instead of "disabled" attribute');
                        }

                        if (this.action === 'cut' && (target.hasAttribute('readonly') || target.hasAttribute('disabled'))) {
                            throw new Error('Invalid "target" attribute. You can\'t cut text from elements with "readonly" or "disabled" attributes');
                        }

                        this._target = target;
                    } else {
                        throw new Error('Invalid "target" value, use a valid Element');
                    }
                }
            },
            get: function get() {
                return this._target;
            }
        }]);

        return ClipboardAction;
    }();

    module.exports = ClipboardAction;
});
},{"select":9}],3:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', './clipboard-action', 'tiny-emitter', 'good-listener'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('./clipboard-action'), require('tiny-emitter'), require('good-listener'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.clipboardAction, global.tinyEmitter, global.goodListener);
        global.clipboard = mod.exports;
    }
})(this, function (module, _clipboardAction, _tinyEmitter, _goodListener) {
    'use strict';

    var _clipboardAction2 = _interopRequireDefault(_clipboardAction);

    var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

    var _goodListener2 = _interopRequireDefault(_goodListener);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    var Clipboard = function (_Emitter) {
        _inherits(Clipboard, _Emitter);

        /**
         * @param {String|HTMLElement|HTMLCollection|NodeList} trigger
         * @param {Object} options
         */

        function Clipboard(trigger, options) {
            _classCallCheck(this, Clipboard);

            var _this = _possibleConstructorReturn(this, _Emitter.call(this));

            _this.resolveOptions(options);
            _this.listenClick(trigger);
            return _this;
        }

        /**
         * Defines if attributes would be resolved using internal setter functions
         * or custom functions that were passed in the constructor.
         * @param {Object} options
         */


        Clipboard.prototype.resolveOptions = function resolveOptions() {
            var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            this.action = typeof options.action === 'function' ? options.action : this.defaultAction;
            this.target = typeof options.target === 'function' ? options.target : this.defaultTarget;
            this.text = typeof options.text === 'function' ? options.text : this.defaultText;
        };

        Clipboard.prototype.listenClick = function listenClick(trigger) {
            var _this2 = this;

            this.listener = (0, _goodListener2.default)(trigger, 'click', function (e) {
                return _this2.onClick(e);
            });
        };

        Clipboard.prototype.onClick = function onClick(e) {
            var trigger = e.delegateTarget || e.currentTarget;

            if (this.clipboardAction) {
                this.clipboardAction = null;
            }

            this.clipboardAction = new _clipboardAction2.default({
                action: this.action(trigger),
                target: this.target(trigger),
                text: this.text(trigger),
                trigger: trigger,
                emitter: this
            });
        };

        Clipboard.prototype.defaultAction = function defaultAction(trigger) {
            return getAttributeValue('action', trigger);
        };

        Clipboard.prototype.defaultTarget = function defaultTarget(trigger) {
            var selector = getAttributeValue('target', trigger);

            if (selector) {
                return document.querySelector(selector);
            }
        };

        Clipboard.prototype.defaultText = function defaultText(trigger) {
            return getAttributeValue('text', trigger);
        };

        Clipboard.prototype.destroy = function destroy() {
            this.listener.destroy();

            if (this.clipboardAction) {
                this.clipboardAction.destroy();
                this.clipboardAction = null;
            }
        };

        return Clipboard;
    }(_tinyEmitter2.default);

    /**
     * Helper function to retrieve attribute value.
     * @param {String} suffix
     * @param {Element} element
     */
    function getAttributeValue(suffix, element) {
        var attribute = 'data-clipboard-' + suffix;

        if (!element.hasAttribute(attribute)) {
            return;
        }

        return element.getAttribute(attribute);
    }

    module.exports = Clipboard;
});
},{"./clipboard-action":2,"good-listener":8,"tiny-emitter":10}],4:[function(require,module,exports){
var matches = require('matches-selector')

module.exports = function (element, selector, checkYoSelf) {
  var parent = checkYoSelf ? element : element.parentNode

  while (parent && parent !== document) {
    if (matches(parent, selector)) return parent;
    parent = parent.parentNode
  }
}

},{"matches-selector":5}],5:[function(require,module,exports){

/**
 * Element prototype.
 */

var proto = Element.prototype;

/**
 * Vendor function.
 */

var vendor = proto.matchesSelector
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

/**
 * Expose `match()`.
 */

module.exports = match;

/**
 * Match `el` to `selector`.
 *
 * @param {Element} el
 * @param {String} selector
 * @return {Boolean}
 * @api public
 */

function match(el, selector) {
  if (vendor) return vendor.call(el, selector);
  var nodes = el.parentNode.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i] == el) return true;
  }
  return false;
}
},{}],6:[function(require,module,exports){
var closest = require('closest');

/**
 * Delegates event to a selector.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @param {Boolean} useCapture
 * @return {Object}
 */
function delegate(element, selector, type, callback, useCapture) {
    var listenerFn = listener.apply(this, arguments);

    element.addEventListener(type, listenerFn, useCapture);

    return {
        destroy: function() {
            element.removeEventListener(type, listenerFn, useCapture);
        }
    }
}

/**
 * Finds closest match and invokes callback.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Function}
 */
function listener(element, selector, type, callback) {
    return function(e) {
        e.delegateTarget = closest(e.target, selector, true);

        if (e.delegateTarget) {
            callback.call(element, e);
        }
    }
}

module.exports = delegate;

},{"closest":4}],7:[function(require,module,exports){
/**
 * Check if argument is a HTML element.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.node = function(value) {
    return value !== undefined
        && value instanceof HTMLElement
        && value.nodeType === 1;
};

/**
 * Check if argument is a list of HTML elements.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.nodeList = function(value) {
    var type = Object.prototype.toString.call(value);

    return value !== undefined
        && (type === '[object NodeList]' || type === '[object HTMLCollection]')
        && ('length' in value)
        && (value.length === 0 || exports.node(value[0]));
};

/**
 * Check if argument is a string.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.string = function(value) {
    return typeof value === 'string'
        || value instanceof String;
};

/**
 * Check if argument is a function.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.fn = function(value) {
    var type = Object.prototype.toString.call(value);

    return type === '[object Function]';
};

},{}],8:[function(require,module,exports){
var is = require('./is');
var delegate = require('delegate');

/**
 * Validates all params and calls the right
 * listener function based on its target type.
 *
 * @param {String|HTMLElement|HTMLCollection|NodeList} target
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listen(target, type, callback) {
    if (!target && !type && !callback) {
        throw new Error('Missing required arguments');
    }

    if (!is.string(type)) {
        throw new TypeError('Second argument must be a String');
    }

    if (!is.fn(callback)) {
        throw new TypeError('Third argument must be a Function');
    }

    if (is.node(target)) {
        return listenNode(target, type, callback);
    }
    else if (is.nodeList(target)) {
        return listenNodeList(target, type, callback);
    }
    else if (is.string(target)) {
        return listenSelector(target, type, callback);
    }
    else {
        throw new TypeError('First argument must be a String, HTMLElement, HTMLCollection, or NodeList');
    }
}

/**
 * Adds an event listener to a HTML element
 * and returns a remove listener function.
 *
 * @param {HTMLElement} node
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNode(node, type, callback) {
    node.addEventListener(type, callback);

    return {
        destroy: function() {
            node.removeEventListener(type, callback);
        }
    }
}

/**
 * Add an event listener to a list of HTML elements
 * and returns a remove listener function.
 *
 * @param {NodeList|HTMLCollection} nodeList
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNodeList(nodeList, type, callback) {
    Array.prototype.forEach.call(nodeList, function(node) {
        node.addEventListener(type, callback);
    });

    return {
        destroy: function() {
            Array.prototype.forEach.call(nodeList, function(node) {
                node.removeEventListener(type, callback);
            });
        }
    }
}

/**
 * Add an event listener to a selector
 * and returns a remove listener function.
 *
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenSelector(selector, type, callback) {
    return delegate(document.body, selector, type, callback);
}

module.exports = listen;

},{"./is":7,"delegate":6}],9:[function(require,module,exports){
function select(element) {
    var selectedText;

    if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
        element.focus();
        element.setSelectionRange(0, element.value.length);

        selectedText = element.value;
    }
    else {
        if (element.hasAttribute('contenteditable')) {
            element.focus();
        }

        var selection = window.getSelection();
        var range = document.createRange();

        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        selectedText = selection.toString();
    }

    return selectedText;
}

module.exports = select;

},{}],10:[function(require,module,exports){
function E () {
  // Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
  on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJiZW5jaC9iZW5jaG1hcmtzX3ZpZXcuanMiLCJub2RlX21vZHVsZXMvY2xpcGJvYXJkL2xpYi9jbGlwYm9hcmQtYWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2NsaXBib2FyZC9saWIvY2xpcGJvYXJkLmpzIiwibm9kZV9tb2R1bGVzL2NsaXBib2FyZC9ub2RlX21vZHVsZXMvZ29vZC1saXN0ZW5lci9ub2RlX21vZHVsZXMvZGVsZWdhdGUvbm9kZV9tb2R1bGVzL2Nsb3Nlc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2xpcGJvYXJkL25vZGVfbW9kdWxlcy9nb29kLWxpc3RlbmVyL25vZGVfbW9kdWxlcy9kZWxlZ2F0ZS9ub2RlX21vZHVsZXMvY2xvc2VzdC9ub2RlX21vZHVsZXMvbWF0Y2hlcy1zZWxlY3Rvci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jbGlwYm9hcmQvbm9kZV9tb2R1bGVzL2dvb2QtbGlzdGVuZXIvbm9kZV9tb2R1bGVzL2RlbGVnYXRlL3NyYy9kZWxlZ2F0ZS5qcyIsIm5vZGVfbW9kdWxlcy9jbGlwYm9hcmQvbm9kZV9tb2R1bGVzL2dvb2QtbGlzdGVuZXIvc3JjL2lzLmpzIiwibm9kZV9tb2R1bGVzL2NsaXBib2FyZC9ub2RlX21vZHVsZXMvZ29vZC1saXN0ZW5lci9zcmMvbGlzdGVuLmpzIiwibm9kZV9tb2R1bGVzL2NsaXBib2FyZC9ub2RlX21vZHVsZXMvc2VsZWN0L3NyYy9zZWxlY3QuanMiLCJub2RlX21vZHVsZXMvY2xpcGJvYXJkL25vZGVfbW9kdWxlcy90aW55LWVtaXR0ZXIvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUdBLElBQUksU0FBQSxHQUFZLE9BQUEsQ0FBUSxXQUFSLENBQWhCLENBSEE7QUFPQSxJQUFJLHFCQUFBLEdBQXdCLEdBQTVCLENBUEE7QUFRQSxJQUFJLG1CQUFBLEdBQXVCLEdBQTNCLENBUkE7QUFVQSxJQUFJLGNBQUEsR0FBaUIsS0FBQSxDQUFNLFdBQU4sQ0FBa0I7QUFBQSxJQUFBLFdBQUEsRUFBQSxnQkFBQTtBQUFBLElBRW5DLE1BQUEsRUFBUSxZQUFXO0FBQUEsUUFDZixPQUFPLEtBQUEsQ0FBQSxhQUFBLENBQUEsS0FBQSxFQUFBO0FBQUEsWUFBSyxLQUFBLEVBQU87QUFBQSxnQkFBQyxLQUFBLEVBQU8sR0FBUjtBQUFBLGdCQUFhLGFBQUEsRUFBZSxNQUFBLENBQU8sV0FBbkM7QUFBQSxnQkFBZ0QsTUFBQSxFQUFRLFFBQXhEO0FBQUEsYUFBWjtBQUFBLFNBQUEsRUFDRixLQUFLLHVCQUFMLEVBREUsRUFFRixLQUFLLGdCQUFMLEVBRkUsQ0FBUCxDQURlO0FBQUEsS0FGZ0I7QUFBQSxJQVNuQyx1QkFBQSxFQUF5QixZQUFXO0FBQUEsUUFDaEMsT0FBTyxLQUFBLENBQUEsYUFBQSxDQUFBLEtBQUEsRUFBQTtBQUFBLFlBQUssS0FBQSxFQUFPO0FBQUEsZ0JBQUMsVUFBQSxFQUFZLEVBQWI7QUFBQSxnQkFBaUIsS0FBQSxFQUFPLEdBQXhCO0FBQUEsZ0JBQTZCLFFBQUEsRUFBVSxPQUF2QztBQUFBLGFBQVo7QUFBQSxZQUE2RCxTQUFBLEVBQVUsWUFBdkU7QUFBQSxTQUFBLEVBQ0gsS0FBQSxDQUFBLGFBQUEsQ0FBQSxJQUFBLEVBQUEsRUFBSSxTQUFBLEVBQVUsY0FBZCxFQUFBLEVBQUEsWUFBQSxDQURHLEVBRUgsS0FBQSxDQUFBLGFBQUEsQ0FBQSxLQUFBLEVBQUEsRUFBSyxTQUFBLEVBQVUsb0JBQWYsRUFBQSxFQUNLLE1BQUEsQ0FBTyxJQUFQLENBQVksS0FBSyxLQUFMLENBQVcsT0FBdkIsRUFBZ0MsR0FBaEMsQ0FBb0MsS0FBSyxzQkFBekMsQ0FETCxDQUZHLEVBS0gsS0FBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLEVBQUE7QUFBQSxZQUNRLFNBQUEsRUFBVztBQUFBLGdCQUNQLE1BRE87QUFBQSxnQkFFUCxXQUZPO0FBQUEsZ0JBR1AsUUFITztBQUFBLGdCQUlOLEtBQUssU0FBTCxPQUFxQixPQUFyQixHQUErQixFQUEvQixHQUFvQyxVQUo5QjtBQUFBLGNBS1QsSUFMUyxDQUtKLEdBTEksQ0FEbkI7QUFBQSxZQU9RLHVCQUFxQixLQUFLLG9CQUFMLEVBUDdCO0FBQUEsU0FBQSxFQUFBLGNBQUEsQ0FMRyxDQUFQLENBRGdDO0FBQUEsS0FURDtBQUFBLElBNEJuQyxzQkFBQSxFQUF3QixVQUFTLElBQVQsRUFBZTtBQUFBLFFBQ25DLE9BQU8sS0FBQSxDQUFBLGFBQUEsQ0FBQSxLQUFBLEVBQUE7QUFBQSxZQUNDLEdBQUEsRUFBSyxJQUROO0FBQUEsWUFFQyxTQUFBLEVBQVc7QUFBQSxnQkFDUCxjQURPO0FBQUEsZ0JBRVAsS0FBSyxrQkFBTCxDQUF3QixJQUF4QixNQUFrQyxTQUFsQyxHQUE4QyxPQUE5QyxHQUF3RCxFQUZqRDtBQUFBLGNBR1QsSUFIUyxDQUdKLEdBSEksQ0FGWjtBQUFBLFNBQUEsRUFNSCxLQUFBLENBQUEsYUFBQSxDQUFBLElBQUEsRUFBQSxJQUFBLEVBQUssSUFBTCxDQU5HLEVBT0YsTUFBQSxDQUFPLElBQVAsQ0FBWSxLQUFLLEtBQUwsQ0FBVyxPQUFYLENBQW1CLElBQW5CLENBQVosRUFBc0MsR0FBdEMsQ0FBMEMsS0FBSyw2QkFBTCxDQUFtQyxJQUFuQyxDQUF3QyxJQUF4QyxFQUE4QyxJQUE5QyxDQUExQyxDQVBFLENBQVAsQ0FEbUM7QUFBQSxLQTVCSjtBQUFBLElBd0NuQyw2QkFBQSxFQUErQixVQUFTLElBQVQsRUFBZSxPQUFmLEVBQXdCO0FBQUEsUUFDbkQsSUFBSSxPQUFBLEdBQVUsS0FBSyxLQUFMLENBQVcsT0FBWCxDQUFtQixJQUFuQixFQUF5QixPQUF6QixDQUFkLENBRG1EO0FBQUEsUUFFbkQsSUFBSSxJQUFBLEdBQU8sSUFBWCxDQUZtRDtBQUFBLFFBSW5ELE9BQU8sS0FBQSxDQUFBLGFBQUEsQ0FBQSxLQUFBLEVBQUE7QUFBQSxZQUNDLE9BQUEsRUFBUyxZQUFXO0FBQUEsZ0JBQ2hCLElBQUEsQ0FBSyxpQkFBTCxDQUF1QixJQUF2QixFQUE2QixPQUE3QixFQURnQjtBQUFBLGFBRHJCO0FBQUEsWUFJQyxLQUFBLEVBQU8sRUFBQyxNQUFBLEVBQVEsU0FBVCxFQUpSO0FBQUEsWUFLQyxHQUFBLEVBQUssT0FMTjtBQUFBLFlBTUMsU0FBQSxFQUFXLE9BQUEsQ0FBUSxNQUFSLEtBQW1CLFNBQW5CLEdBQStCLE9BQS9CLEdBQXlDLEVBTnJEO0FBQUEsU0FBQSxFQU9ILEtBQUEsQ0FBQSxhQUFBLENBQUEsUUFBQSxFQUFBLElBQUEsRUFBUyxPQUFULEVBQUEsR0FBQSxDQVBHLEVBQUEsR0FBQSxFQU8wQixPQUFBLENBQVEsT0FBUixJQUFtQixLQVA3QyxDQUFQLENBSm1EO0FBQUEsS0F4Q3BCO0FBQUEsSUF1RG5DLG9CQUFBLEVBQXNCLFlBQVc7QUFBQSxRQUM3QixJQUFJLE1BQUEsR0FBUyxnQkFBYixDQUQ2QjtBQUFBLFFBRTdCLFNBQVMsSUFBVCxJQUFpQixLQUFLLEtBQUwsQ0FBVyxPQUE1QixFQUFxQztBQUFBLFlBQ2pDLE1BQUEsSUFBVSxVQUFVLElBQVYsR0FBaUIsTUFBM0IsQ0FEaUM7QUFBQSxZQUVqQyxTQUFTLE9BQVQsSUFBb0IsS0FBSyxLQUFMLENBQVcsT0FBWCxDQUFtQixJQUFuQixDQUFwQixFQUE4QztBQUFBLGdCQUMxQyxJQUFJLE1BQUEsR0FBUyxLQUFLLEtBQUwsQ0FBVyxPQUFYLENBQW1CLElBQW5CLEVBQXlCLE9BQXpCLENBQWIsQ0FEMEM7QUFBQSxnQkFFMUMsTUFBQSxJQUFVLE9BQU8sT0FBUCxHQUFpQixNQUFqQixHQUEyQixDQUFBLE1BQUEsQ0FBTyxPQUFQLElBQWtCLEtBQWxCLENBQTNCLEdBQXNELElBQWhFLENBRjBDO0FBQUEsYUFGYjtBQUFBLFNBRlI7QUFBQSxRQVM3QixPQUFPLE1BQVAsQ0FUNkI7QUFBQSxLQXZERTtBQUFBLElBbUVuQyxnQkFBQSxFQUFrQixZQUFXO0FBQUEsUUFDekIsT0FBTyxLQUFBLENBQUEsYUFBQSxDQUFBLEtBQUEsRUFBQTtBQUFBLFlBQUssS0FBQSxFQUFPO0FBQUEsZ0JBQUMsS0FBQSxFQUFPLEdBQVI7QUFBQSxnQkFBYSxVQUFBLEVBQVksR0FBekI7QUFBQSxnQkFBOEIsWUFBQSxFQUFjLEVBQTVDO0FBQUEsYUFBWjtBQUFBLFNBQUEsRUFDRixNQUFBLENBQU8sSUFBUCxDQUFZLEtBQUssS0FBTCxDQUFXLE9BQXZCLEVBQWdDLEdBQWhDLENBQW9DLEtBQUssZUFBekMsQ0FERSxDQUFQLENBRHlCO0FBQUEsS0FuRU07QUFBQSxJQXlFbkMsZUFBQSxFQUFpQixVQUFTLElBQVQsRUFBZTtBQUFBLFFBQzVCLE9BQU8sS0FBQSxDQUFBLGFBQUEsQ0FBQSxLQUFBLEVBQUEsRUFBSyxHQUFBLEVBQUssSUFBVixFQUFBLEVBQ0YsTUFBQSxDQUFPLElBQVAsQ0FBWSxLQUFLLEtBQUwsQ0FBVyxPQUFYLENBQW1CLElBQW5CLENBQVosRUFBc0MsR0FBdEMsQ0FBMEMsS0FBSyxzQkFBTCxDQUE0QixJQUE1QixDQUFpQyxJQUFqQyxFQUF1QyxJQUF2QyxDQUExQyxDQURFLENBQVAsQ0FENEI7QUFBQSxLQXpFRztBQUFBLElBK0VuQyxzQkFBQSxFQUF3QixVQUFTLElBQVQsRUFBZSxPQUFmLEVBQXdCO0FBQUEsUUFDNUMsSUFBSSxPQUFBLEdBQVUsS0FBSyxLQUFMLENBQVcsT0FBWCxDQUFtQixJQUFuQixFQUF5QixPQUF6QixDQUFkLENBRDRDO0FBQUEsUUFFNUMsT0FDUSxLQUFBLENBQUEsYUFBQSxDQUFBLEtBQUEsRUFBQTtBQUFBLFlBQ0ksS0FBQSxFQUFPLEVBQUMsVUFBQSxFQUFZLEVBQWIsRUFEWDtBQUFBLFlBRUksRUFBQSxFQUFJLElBQUEsR0FBTyxPQUZmO0FBQUEsWUFHSSxHQUFBLEVBQUssT0FIVDtBQUFBLFlBSUksU0FBQSxFQUFXLE9BQUEsQ0FBUSxNQUFSLEtBQW1CLFNBQW5CLEdBQStCLE9BQS9CLEdBQXlDLEVBSnhEO0FBQUEsU0FBQSxFQU1JLEtBQUEsQ0FBQSxhQUFBLENBQUEsSUFBQSxFQUFBLEVBQUksU0FBQSxFQUFVLGNBQWQsRUFBQSxFQUE4QixJQUE5QixFQUFBLE1BQUEsRUFBd0MsT0FBeEMsQ0FOSixFQU9DLE9BQUEsQ0FBUSxJQUFSLENBQWEsR0FBYixDQUFpQixVQUFTLEdBQVQsRUFBYyxLQUFkLEVBQXFCO0FBQUEsWUFDbkMsT0FBTyxLQUFBLENBQUEsYUFBQSxDQUFBLEtBQUEsRUFBQTtBQUFBLGdCQUFLLEdBQUEsRUFBSyxLQUFWO0FBQUEsZ0JBQWlCLFNBQUEsRUFBVyxvQkFBb0IsR0FBQSxDQUFJLEtBQXBEO0FBQUEsYUFBQSxFQUE0RCxHQUFBLENBQUksT0FBaEUsQ0FBUCxDQURtQztBQUFBLFNBQXRDLENBUEQsQ0FEUixDQUY0QztBQUFBLEtBL0ViO0FBQUEsSUFnR25DLGlCQUFBLEVBQW1CLFVBQVMsSUFBVCxFQUFlLE9BQWYsRUFBd0I7QUFBQSxRQUN2QyxJQUFJLFFBQUEsR0FBVyxHQUFmLENBRHVDO0FBQUEsUUFFdkMsSUFBSSxTQUFBLEdBQWEsSUFBSSxJQUFKLEdBQVksT0FBWixFQUFqQixDQUZ1QztBQUFBLFFBR3ZDLElBQUksWUFBQSxHQUFlLE1BQUEsQ0FBTyxXQUExQixDQUh1QztBQUFBLFFBS3ZDLHFCQUFBLENBQXNCLFNBQVMsS0FBVCxHQUFpQjtBQUFBLFlBQ25DLElBQUksVUFBQSxHQUFhLFFBQUEsQ0FBUyxjQUFULENBQXdCLElBQUEsR0FBTyxPQUEvQixFQUF3QyxTQUF6RCxDQURtQztBQUFBLFlBRW5DLElBQUksSUFBQSxHQUFRLElBQUksSUFBSixHQUFZLE9BQVosRUFBWixDQUZtQztBQUFBLFlBR25DLElBQUksT0FBQSxHQUFVLElBQUEsQ0FBSyxHQUFMLENBQVUsQ0FBQSxJQUFBLEdBQU8sU0FBUCxDQUFELEdBQXFCLFFBQTlCLEVBQXdDLENBQXhDLElBQThDLENBQUEsVUFBQSxHQUFhLFlBQWIsQ0FBOUMsR0FBMkUsWUFBekYsQ0FIbUM7QUFBQSxZQUluQyxNQUFBLENBQU8sUUFBUCxDQUFnQixDQUFoQixFQUFtQixPQUFuQixFQUptQztBQUFBLFlBS25DLElBQUksSUFBQSxHQUFPLFNBQUEsR0FBWSxRQUF2QjtBQUFBLGdCQUFpQyxxQkFBQSxDQUFzQixLQUF0QixFQUxFO0FBQUEsU0FBdkMsRUFMdUM7QUFBQSxLQWhHUjtBQUFBLElBOEduQyxlQUFBLEVBQWlCLFlBQVc7QUFBQSxRQUN4QixJQUFJLE9BQUEsR0FBVSxFQUFkLENBRHdCO0FBQUEsUUFHeEIsU0FBUyxJQUFULElBQWlCLEtBQUssS0FBTCxDQUFXLFVBQTVCLEVBQXdDO0FBQUEsWUFDcEMsU0FBUyxPQUFULElBQW9CLEtBQUssS0FBTCxDQUFXLFVBQVgsQ0FBc0IsSUFBdEIsQ0FBcEIsRUFBaUQ7QUFBQSxnQkFDN0MsSUFBSSxDQUFDLEtBQUssS0FBTCxDQUFXLGVBQVosSUFBK0IsS0FBSyxLQUFMLENBQVcsZUFBWCxDQUEyQixJQUEzQixFQUFpQyxPQUFqQyxDQUFuQyxFQUE4RTtBQUFBLG9CQUMxRSxPQUFBLENBQVEsSUFBUixJQUFnQixPQUFBLENBQVEsSUFBUixLQUFpQixFQUFqQyxDQUQwRTtBQUFBLG9CQUUxRSxPQUFBLENBQVEsSUFBUixFQUFjLE9BQWQsSUFBeUI7QUFBQSx3QkFDckIsTUFBQSxFQUFRLFNBRGE7QUFBQSx3QkFFckIsSUFBQSxFQUFNLEVBRmU7QUFBQSxxQkFBekIsQ0FGMEU7QUFBQSxpQkFEakM7QUFBQSxhQURiO0FBQUEsU0FIaEI7QUFBQSxRQWV4QixPQUFPLEVBQUUsT0FBQSxFQUFTLE9BQVgsRUFBUCxDQWZ3QjtBQUFBLEtBOUdPO0FBQUEsSUFnSW5DLGlCQUFBLEVBQW1CLFlBQVc7QUFBQSxRQUMxQixJQUFJLElBQUEsR0FBTyxJQUFYLENBRDBCO0FBQUEsUUFHMUIsV0FBQSxDQUFZLE1BQUEsQ0FBTyxJQUFQLENBQVksSUFBQSxDQUFLLEtBQUwsQ0FBVyxPQUF2QixDQUFaLEVBQTZDLFVBQVMsSUFBVCxFQUFlLFFBQWYsRUFBeUI7QUFBQSxZQUNsRSxXQUFBLENBQVksTUFBQSxDQUFPLElBQVAsQ0FBWSxJQUFBLENBQUssS0FBTCxDQUFXLE9BQVgsQ0FBbUIsSUFBbkIsQ0FBWixDQUFaLEVBQW1ELFVBQVMsT0FBVCxFQUFrQixRQUFsQixFQUE0QjtBQUFBLGdCQUMzRSxJQUFBLENBQUssaUJBQUwsQ0FBdUIsSUFBdkIsRUFBNkIsT0FBN0IsRUFEMkU7QUFBQSxnQkFFM0UsSUFBQSxDQUFLLFlBQUwsQ0FBa0IsSUFBbEIsRUFBd0IsT0FBeEIsRUFBaUMsUUFBakMsRUFGMkU7QUFBQSxhQUEvRSxFQUdHLFFBSEgsRUFEa0U7QUFBQSxTQUF0RSxFQUtHLFVBQVMsR0FBVCxFQUFjO0FBQUEsWUFDYixJQUFJLEdBQUo7QUFBQSxnQkFBUyxNQUFNLEdBQU4sQ0FESTtBQUFBLFNBTGpCLEVBSDBCO0FBQUEsS0FoSUs7QUFBQSxJQTZJbkMsWUFBQSxFQUFjLFVBQVMsSUFBVCxFQUFlLE9BQWYsRUFBd0IsYUFBeEIsRUFBdUM7QUFBQSxRQUNqRCxJQUFJLElBQUEsR0FBTyxJQUFYLENBRGlEO0FBQUEsUUFFakQsSUFBSSxPQUFBLEdBQVUsS0FBSyxLQUFMLENBQVcsT0FBWCxDQUFtQixJQUFuQixFQUF5QixPQUF6QixDQUFkLENBRmlEO0FBQUEsUUFJakQsU0FBUyxHQUFULENBQWEsS0FBYixFQUFvQixPQUFwQixFQUE2QjtBQUFBLFlBQ3pCLE9BQUEsQ0FBUSxJQUFSLENBQWEsSUFBYixDQUFrQjtBQUFBLGdCQUNkLEtBQUEsRUFBTyxLQUFBLElBQVMsTUFERjtBQUFBLGdCQUVkLE9BQUEsRUFBUyxPQUZLO0FBQUEsYUFBbEIsRUFEeUI7QUFBQSxZQUt6QixJQUFBLENBQUssV0FBTCxHQUx5QjtBQUFBLFNBSm9CO0FBQUEsUUFZakQsU0FBUyxRQUFULEdBQW9CO0FBQUEsWUFDaEIsVUFBQSxDQUFXLGFBQVgsRUFBMEIscUJBQTFCLEVBRGdCO0FBQUEsU0FaNkI7QUFBQSxRQWdCakQsT0FBQSxDQUFRLE1BQVIsR0FBaUIsU0FBakIsQ0FoQmlEO0FBQUEsUUFpQmpELEtBQUssaUJBQUwsQ0FBdUIsSUFBdkIsRUFBNkIsT0FBN0IsRUFqQmlEO0FBQUEsUUFrQmpELEdBQUEsQ0FBSSxNQUFKLEVBQVksVUFBWixFQWxCaUQ7QUFBQSxRQW9CakQsVUFBQSxDQUFXLFlBQVc7QUFBQSxZQUNsQixJQUFJLE9BQUEsR0FBVSxJQUFBLENBQUssS0FBTCxDQUFXLFVBQVgsQ0FBc0IsSUFBdEIsRUFBNEIsT0FBNUIsR0FBZCxDQURrQjtBQUFBLFlBR2xCLE9BQUEsQ0FBUSxFQUFSLENBQVcsS0FBWCxFQUFrQixVQUFTLEtBQVQsRUFBZ0I7QUFBQSxnQkFDOUIsR0FBQSxDQUFJLEtBQUEsQ0FBTSxLQUFWLEVBQWlCLEtBQUEsQ0FBTSxPQUF2QixFQUQ4QjtBQUFBLGFBQWxDLEVBSGtCO0FBQUEsWUFRbEIsT0FBQSxDQUFRLEVBQVIsQ0FBVyxLQUFYLEVBQWtCLFVBQVMsS0FBVCxFQUFnQjtBQUFBLGdCQUM5QixPQUFBLENBQVEsT0FBUixHQUFrQixLQUFBLENBQU0sT0FBeEIsQ0FEOEI7QUFBQSxnQkFFOUIsT0FBQSxDQUFRLE1BQVIsR0FBaUIsT0FBakIsQ0FGOEI7QUFBQSxnQkFHOUIsR0FBQSxDQUFJLE9BQUosRUFBYSxLQUFBLENBQU0sT0FBbkIsRUFIOEI7QUFBQSxnQkFJOUIsUUFBQSxHQUo4QjtBQUFBLGFBQWxDLEVBUmtCO0FBQUEsWUFnQmxCLE9BQUEsQ0FBUSxFQUFSLENBQVcsT0FBWCxFQUFvQixVQUFTLEtBQVQsRUFBZ0I7QUFBQSxnQkFDaEMsT0FBQSxDQUFRLE1BQVIsR0FBaUIsU0FBakIsQ0FEZ0M7QUFBQSxnQkFFaEMsR0FBQSxDQUFJLEtBQUosRUFBVyxLQUFBLENBQU0sS0FBakIsRUFGZ0M7QUFBQSxnQkFHaEMsUUFBQSxHQUhnQztBQUFBLGFBQXBDLEVBaEJrQjtBQUFBLFNBQXRCLEVBc0JHLG1CQXRCSCxFQXBCaUQ7QUFBQSxLQTdJbEI7QUFBQSxJQTBMbkMseUJBQUEsRUFBMkIsVUFBUyxJQUFULEVBQWUsT0FBZixFQUF3QjtBQUFBLFFBQy9DLE9BQU8sS0FBSyxLQUFMLENBQVcsT0FBWCxDQUFtQixJQUFuQixFQUF5QixPQUF6QixFQUFrQyxNQUF6QyxDQUQrQztBQUFBLEtBMUxoQjtBQUFBLElBOExuQyxrQkFBQSxFQUFvQixVQUFTLElBQVQsRUFBZTtBQUFBLFFBQy9CLE9BQU8sY0FBQSxDQUFlLE1BQUEsQ0FBTyxJQUFQLENBQVksS0FBSyxLQUFMLENBQVcsT0FBWCxDQUFtQixJQUFuQixDQUFaLEVBQXNDLEdBQXRDLENBQTBDLFVBQVMsT0FBVCxFQUFrQjtBQUFBLFlBQzlFLE9BQU8sS0FBSyx5QkFBTCxDQUErQixJQUEvQixFQUFxQyxPQUFyQyxDQUFQLENBRDhFO0FBQUEsU0FBNUQsRUFFbkIsSUFGbUIsQ0FBZixDQUFQLENBRCtCO0FBQUEsS0E5TEE7QUFBQSxJQW9NbkMsU0FBQSxHQUFZO0FBQUEsUUFDUixPQUFPLGNBQUEsQ0FBZSxNQUFBLENBQU8sSUFBUCxDQUFZLEtBQUssS0FBTCxDQUFXLE9BQXZCLEVBQWdDLEdBQWhDLENBQW9DLFVBQVMsSUFBVCxFQUFlO0FBQUEsWUFDckUsT0FBTyxLQUFLLGtCQUFMLENBQXdCLElBQXhCLENBQVAsQ0FEcUU7QUFBQSxTQUFuRCxFQUVuQixJQUZtQixDQUFmLENBQVAsQ0FEUTtBQUFBLEtBcE11QjtBQUFBLENBQWxCLENBQXJCLENBVkE7QUFxTkEsU0FBUyxjQUFULENBQXdCLFFBQXhCLEVBQWtDO0FBQUEsSUFDOUIsSUFBSSxRQUFBLENBQVMsT0FBVCxDQUFpQixTQUFqQixNQUFnQyxDQUFDLENBQXJDLEVBQXdDO0FBQUEsUUFDcEMsT0FBTyxTQUFQLENBRG9DO0FBQUEsS0FBeEMsTUFFTyxJQUFJLFFBQUEsQ0FBUyxPQUFULENBQWlCLFNBQWpCLE1BQWdDLENBQUMsQ0FBckMsRUFBd0M7QUFBQSxRQUMzQyxPQUFPLFNBQVAsQ0FEMkM7QUFBQSxLQUF4QyxNQUVBO0FBQUEsUUFDSCxPQUFPLE9BQVAsQ0FERztBQUFBLEtBTHVCO0FBQUEsQ0FyTmxDO0FBK05BLElBQUksU0FBQSxHQUFZLElBQUksU0FBSixDQUFjLFlBQWQsQ0FBaEIsQ0EvTkE7QUFpT0EsUUFBQSxDQUFTLE1BQVQsQ0FDSSxLQUFBLENBQUEsYUFBQSxDQUFDLGNBQUQsRUFBQTtBQUFBLElBQ0ksVUFBQSxFQUFZLE1BQUEsQ0FBTyxrQkFEdkI7QUFBQSxJQUVJLGVBQUEsRUFBaUIsVUFBUyxJQUFULEVBQWU7QUFBQSxRQUM1QixJQUFJLFVBQUEsR0FBYSxNQUFBLENBQU8sUUFBUCxDQUFnQixJQUFoQixDQUFxQixNQUFyQixDQUE0QixDQUE1QixDQUFqQixDQUQ0QjtBQUFBLFFBRTVCLE9BQU8sQ0FBQyxVQUFELElBQWUsSUFBQSxLQUFTLFVBQS9CLENBRjRCO0FBQUEsS0FGcEM7QUFBQSxDQUFBLENBREosRUFRSSxRQUFBLENBQVMsY0FBVCxDQUF3QixZQUF4QixDQVJKLEVBak9BO0FBNE9BLFNBQVMsV0FBVCxDQUFxQixLQUFyQixFQUE0QixRQUE1QixFQUFzQyxRQUF0QyxFQUFnRDtBQUFBLElBQzVDLElBQUksS0FBQSxDQUFNLE1BQVYsRUFBa0I7QUFBQSxRQUNkLFFBQUEsQ0FBUyxLQUFBLENBQU0sQ0FBTixDQUFULEVBQW1CLFVBQVMsR0FBVCxFQUFjO0FBQUEsWUFDN0IsSUFBSSxHQUFKO0FBQUEsZ0JBQVMsUUFBQSxDQUFTLEdBQVQsRUFBVDtBQUFBO0FBQUEsZ0JBQ0ssV0FBQSxDQUFZLEtBQUEsQ0FBTSxLQUFOLENBQVksQ0FBWixDQUFaLEVBQTRCLFFBQTVCLEVBQXNDLFFBQXRDLEVBRndCO0FBQUEsU0FBakMsRUFEYztBQUFBLEtBQWxCLE1BS087QUFBQSxRQUNILFFBQUEsR0FERztBQUFBLEtBTnFDO0FBQUE7Ozs7QUM1T2hEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG4vKmVzbGludCBuby11bnVzZWQtdmFyczogW1wiZXJyb3JcIiwgeyBcInZhcnNJZ25vcmVQYXR0ZXJuXCI6IFwiQmVuY2htYXJrc1ZpZXd8Y2xpcGJvYXJkXCIgfV0qL1xuXG52YXIgQ2xpcGJvYXJkID0gcmVxdWlyZSgnY2xpcGJvYXJkJyk7XG5cbi8vIEJlbmNobWFyayByZXN1bHRzIHNlZW0gdG8gYmUgbW9yZSBjb25zaXN0ZW50IHdpdGggYSB3YXJtdXAgYW5kIGNvb2xkb3duXG4vLyBwZXJpb2QuIFRoZXNlIHZhbHVlcyBhcmUgbWVhc3VyZWQgaW4gbWlsbGlzZWNvbmRzLlxudmFyIGJlbmNobWFya0Nvb2xkb3duVGltZSA9IDI1MDtcbnZhciBiZW5jaG1hcmtXYXJtdXBUaW1lICA9IDI1MDtcblxudmFyIEJlbmNobWFya3NWaWV3ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIDxkaXYgc3R5bGU9e3t3aWR0aDogOTYwLCBwYWRkaW5nQm90dG9tOiB3aW5kb3cuaW5uZXJIZWlnaHQsIG1hcmdpbjogJzAgYXV0byd9fT5cbiAgICAgICAgICAgIHt0aGlzLnJlbmRlclNpZGViYXJCZW5jaG1hcmtzKCl9XG4gICAgICAgICAgICB7dGhpcy5yZW5kZXJCZW5jaG1hcmtzKCl9XG4gICAgICAgIDwvZGl2PjtcbiAgICB9LFxuXG4gICAgcmVuZGVyU2lkZWJhckJlbmNobWFya3M6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gPGRpdiBzdHlsZT17e3BhZGRpbmdUb3A6IDQwLCB3aWR0aDogMjgwLCBwb3NpdGlvbjogJ2ZpeGVkJ319IGNsYXNzTmFtZT0ndGV4dC1yaWdodCc+XG4gICAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwic3BhY2UtYm90dG9tXCI+QmVuY2htYXJrczwvaDE+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLWJvdHRvbSBzbWFsbFwiPlxuICAgICAgICAgICAgICAgIHtPYmplY3Qua2V5cyh0aGlzLnN0YXRlLnJlc3VsdHMpLm1hcCh0aGlzLnJlbmRlclNpZGViYXJCZW5jaG1hcmspfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e1tcbiAgICAgICAgICAgICAgICAgICAgICAgICdpY29uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdjbGlwYm9hcmQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2J1dHRvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAodGhpcy5nZXRTdGF0dXMoKSA9PT0gJ2VuZGVkJyA/ICcnIDogJ2Rpc2FibGVkJylcbiAgICAgICAgICAgICAgICAgICAgXS5qb2luKCcgJyl9XG4gICAgICAgICAgICAgICAgICAgIGRhdGEtY2xpcGJvYXJkLXRleHQ9e3RoaXMucmVuZGVyVGV4dEJlbmNobWFya3MoKX0+XG4gICAgICAgICAgICAgICAgQ29weSBSZXN1bHRzXG4gICAgICAgICAgICA8L2E+XG4gICAgICAgIDwvZGl2PjtcbiAgICB9LFxuXG4gICAgcmVuZGVyU2lkZWJhckJlbmNobWFyazogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICByZXR1cm4gPGRpdlxuICAgICAgICAgICAgICAgIGtleT17bmFtZX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e1tcbiAgICAgICAgICAgICAgICAgICAgJ3NwYWNlLWJvdHRvbScsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0QmVuY2htYXJrU3RhdHVzKG5hbWUpID09PSAnd2FpdGluZycgPyAncXVpZXQnIDogJydcbiAgICAgICAgICAgICAgICBdLmpvaW4oJyAnKX0+XG4gICAgICAgICAgICA8aDM+e25hbWV9PC9oMz5cbiAgICAgICAgICAgIHtPYmplY3Qua2V5cyh0aGlzLnN0YXRlLnJlc3VsdHNbbmFtZV0pLm1hcCh0aGlzLnJlbmRlclNpZGViYXJCZW5jaG1hcmtWZXJzaW9uLmJpbmQodGhpcywgbmFtZSkpfVxuICAgICAgICA8L2Rpdj47XG4gICAgfSxcblxuICAgIHJlbmRlclNpZGViYXJCZW5jaG1hcmtWZXJzaW9uOiBmdW5jdGlvbihuYW1lLCB2ZXJzaW9uKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5zdGF0ZS5yZXN1bHRzW25hbWVdW3ZlcnNpb25dO1xuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG5cbiAgICAgICAgcmV0dXJuIDxkaXZcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5zY3JvbGxUb0JlbmNobWFyayhuYW1lLCB2ZXJzaW9uKTtcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgIHN0eWxlPXt7Y3Vyc29yOiAncG9pbnRlcid9fVxuICAgICAgICAgICAgICAgIGtleT17dmVyc2lvbn1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e3Jlc3VsdHMuc3RhdHVzID09PSAnd2FpdGluZycgPyAncXVpZXQnIDogJyd9PlxuICAgICAgICAgICAgPHN0cm9uZz57dmVyc2lvbn06PC9zdHJvbmc+IHtyZXN1bHRzLm1lc3NhZ2UgfHwgJy4uLid9XG4gICAgICAgIDwvZGl2PjtcbiAgICB9LFxuXG4gICAgcmVuZGVyVGV4dEJlbmNobWFya3M6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgb3V0cHV0ID0gJyMgQmVuY2htYXJrc1xcbic7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5zdGF0ZS5yZXN1bHRzKSB7XG4gICAgICAgICAgICBvdXRwdXQgKz0gJ1xcbiMjICcgKyBuYW1lICsgJ1xcblxcbic7XG4gICAgICAgICAgICBmb3IgKHZhciB2ZXJzaW9uIGluIHRoaXMuc3RhdGUucmVzdWx0c1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSB0aGlzLnN0YXRlLnJlc3VsdHNbbmFtZV1bdmVyc2lvbl07XG4gICAgICAgICAgICAgICAgb3V0cHV0ICs9ICcqKicgKyB2ZXJzaW9uICsgJzoqKiAnICsgKHJlc3VsdC5tZXNzYWdlIHx8ICcuLi4nKSArICdcXG4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfSxcblxuICAgIHJlbmRlckJlbmNobWFya3M6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gPGRpdiBzdHlsZT17e3dpZHRoOiA1OTAsIG1hcmdpbkxlZnQ6IDMyMCwgbWFyZ2luQm90dG9tOiA2MH19PlxuICAgICAgICAgICAge09iamVjdC5rZXlzKHRoaXMuc3RhdGUucmVzdWx0cykubWFwKHRoaXMucmVuZGVyQmVuY2htYXJrKX1cbiAgICAgICAgPC9kaXY+O1xuICAgIH0sXG5cbiAgICByZW5kZXJCZW5jaG1hcms6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIDxkaXYga2V5PXtuYW1lfT5cbiAgICAgICAgICAgIHtPYmplY3Qua2V5cyh0aGlzLnN0YXRlLnJlc3VsdHNbbmFtZV0pLm1hcCh0aGlzLnJlbmRlckJlbmNobWFya1ZlcnNpb24uYmluZCh0aGlzLCBuYW1lKSl9XG4gICAgICAgIDwvZGl2PjtcbiAgICB9LFxuXG4gICAgcmVuZGVyQmVuY2htYXJrVmVyc2lvbjogZnVuY3Rpb24obmFtZSwgdmVyc2lvbikge1xuICAgICAgICB2YXIgcmVzdWx0cyA9IHRoaXMuc3RhdGUucmVzdWx0c1tuYW1lXVt2ZXJzaW9uXTtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7cGFkZGluZ1RvcDogNDB9fVxuICAgICAgICAgICAgICAgICAgICBpZD17bmFtZSArIHZlcnNpb259XG4gICAgICAgICAgICAgICAgICAgIGtleT17dmVyc2lvbn1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtyZXN1bHRzLnN0YXR1cyA9PT0gJ3dhaXRpbmcnID8gJ3F1aWV0JyA6ICcnfT5cblxuICAgICAgICAgICAgICAgICAgICA8aDIgY2xhc3NOYW1lPSdzcGFjZS1ib3R0b20nPntuYW1lfSBvbiB7dmVyc2lvbn08L2gyPlxuICAgICAgICAgICAgICAgIHtyZXN1bHRzLmxvZ3MubWFwKGZ1bmN0aW9uKGxvZywgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDxkaXYga2V5PXtpbmRleH0gY2xhc3NOYW1lPXsncGFkMSBkYXJrIGZpbGwtJyArIGxvZy5jb2xvcn0+e2xvZy5tZXNzYWdlfTwvZGl2PjtcbiAgICAgICAgICAgICAgICB9KX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH0sXG5cbiAgICBzY3JvbGxUb0JlbmNobWFyazogZnVuY3Rpb24obmFtZSwgdmVyc2lvbikge1xuICAgICAgICB2YXIgZHVyYXRpb24gPSAzMDA7XG4gICAgICAgIHZhciBzdGFydFRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpO1xuICAgICAgICB2YXIgc3RhcnRZT2Zmc2V0ID0gd2luZG93LnBhZ2VZT2Zmc2V0O1xuXG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbiBmcmFtZSgpIHtcbiAgICAgICAgICAgIHZhciBlbmRZT2Zmc2V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobmFtZSArIHZlcnNpb24pLm9mZnNldFRvcDtcbiAgICAgICAgICAgIHZhciB0aW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcbiAgICAgICAgICAgIHZhciB5T2Zmc2V0ID0gTWF0aC5taW4oKHRpbWUgLSBzdGFydFRpbWUpIC8gZHVyYXRpb24sIDEpICogKGVuZFlPZmZzZXQgLSBzdGFydFlPZmZzZXQpICsgc3RhcnRZT2Zmc2V0O1xuICAgICAgICAgICAgd2luZG93LnNjcm9sbFRvKDAsIHlPZmZzZXQpO1xuICAgICAgICAgICAgaWYgKHRpbWUgPCBzdGFydFRpbWUgKyBkdXJhdGlvbikgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZXN1bHRzID0ge307XG5cbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnByb3BzLmJlbmNobWFya3MpIHtcbiAgICAgICAgICAgIGZvciAodmFyIHZlcnNpb24gaW4gdGhpcy5wcm9wcy5iZW5jaG1hcmtzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzLmJlbmNobWFya0ZpbHRlciB8fCB0aGlzLnByb3BzLmJlbmNobWFya0ZpbHRlcihuYW1lLCB2ZXJzaW9uKSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW25hbWVdID0gcmVzdWx0c1tuYW1lXSB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1tuYW1lXVt2ZXJzaW9uXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ3dhaXRpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nczogW11cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyByZXN1bHRzOiByZXN1bHRzIH07XG4gICAgfSxcblxuICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuXG4gICAgICAgIGFzeW5jU2VyaWVzKE9iamVjdC5rZXlzKHRoYXQuc3RhdGUucmVzdWx0cyksIGZ1bmN0aW9uKG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBhc3luY1NlcmllcyhPYmplY3Qua2V5cyh0aGF0LnN0YXRlLnJlc3VsdHNbbmFtZV0pLCBmdW5jdGlvbih2ZXJzaW9uLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHRoYXQuc2Nyb2xsVG9CZW5jaG1hcmsobmFtZSwgdmVyc2lvbik7XG4gICAgICAgICAgICAgICAgdGhhdC5ydW5CZW5jaG1hcmsobmFtZSwgdmVyc2lvbiwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIHJ1bkJlbmNobWFyazogZnVuY3Rpb24obmFtZSwgdmVyc2lvbiwgb3V0ZXJDYWxsYmFjaykge1xuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIHZhciByZXN1bHRzID0gdGhpcy5zdGF0ZS5yZXN1bHRzW25hbWVdW3ZlcnNpb25dO1xuXG4gICAgICAgIGZ1bmN0aW9uIGxvZyhjb2xvciwgbWVzc2FnZSkge1xuICAgICAgICAgICAgcmVzdWx0cy5sb2dzLnB1c2goe1xuICAgICAgICAgICAgICAgIGNvbG9yOiBjb2xvciB8fCAnYmx1ZScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGF0LmZvcmNlVXBkYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjYWxsYmFjaygpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJDYWxsYmFjaywgYmVuY2htYXJrQ29vbGRvd25UaW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdHMuc3RhdHVzID0gJ3J1bm5pbmcnO1xuICAgICAgICB0aGlzLnNjcm9sbFRvQmVuY2htYXJrKG5hbWUsIHZlcnNpb24pO1xuICAgICAgICBsb2coJ2RhcmsnLCAnc3RhcnRpbmcnKTtcblxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGVtaXR0ZXIgPSB0aGF0LnByb3BzLmJlbmNobWFya3NbbmFtZV1bdmVyc2lvbl0oKTtcblxuICAgICAgICAgICAgZW1pdHRlci5vbignbG9nJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsb2coZXZlbnQuY29sb3IsIGV2ZW50Lm1lc3NhZ2UpO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZW1pdHRlci5vbignZW5kJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLm1lc3NhZ2UgPSBldmVudC5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMuc3RhdHVzID0gJ2VuZGVkJztcbiAgICAgICAgICAgICAgICBsb2coJ2dyZWVuJywgZXZlbnQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGVtaXR0ZXIub24oJ2Vycm9yJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnN0YXR1cyA9ICdlcnJvcmVkJztcbiAgICAgICAgICAgICAgICBsb2coJ3JlZCcsIGV2ZW50LmVycm9yKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfSwgYmVuY2htYXJrV2FybXVwVGltZSk7XG4gICAgfSxcblxuICAgIGdldEJlbmNobWFya1ZlcnNpb25TdGF0dXM6IGZ1bmN0aW9uKG5hbWUsIHZlcnNpb24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGUucmVzdWx0c1tuYW1lXVt2ZXJzaW9uXS5zdGF0dXM7XG4gICAgfSxcblxuICAgIGdldEJlbmNobWFya1N0YXR1czogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICByZXR1cm4gcmVkdWNlU3RhdHVzZXMoT2JqZWN0LmtleXModGhpcy5zdGF0ZS5yZXN1bHRzW25hbWVdKS5tYXAoZnVuY3Rpb24odmVyc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QmVuY2htYXJrVmVyc2lvblN0YXR1cyhuYW1lLCB2ZXJzaW9uKTtcbiAgICAgICAgfSwgdGhpcykpO1xuICAgIH0sXG5cbiAgICBnZXRTdGF0dXMoKSB7XG4gICAgICAgIHJldHVybiByZWR1Y2VTdGF0dXNlcyhPYmplY3Qua2V5cyh0aGlzLnN0YXRlLnJlc3VsdHMpLm1hcChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRCZW5jaG1hcmtTdGF0dXMobmFtZSk7XG4gICAgICAgIH0sIHRoaXMpKTtcbiAgICB9XG59KTtcblxuZnVuY3Rpb24gcmVkdWNlU3RhdHVzZXMoc3RhdHVzZXMpIHtcbiAgICBpZiAoc3RhdHVzZXMuaW5kZXhPZigncnVubmluZycpICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gJ3J1bm5pbmcnO1xuICAgIH0gZWxzZSBpZiAoc3RhdHVzZXMuaW5kZXhPZignd2FpdGluZycpICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gJ3dhaXRpbmcnO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnZW5kZWQnO1xuICAgIH1cbn1cblxudmFyIGNsaXBib2FyZCA9IG5ldyBDbGlwYm9hcmQoJy5jbGlwYm9hcmQnKTtcblxuUmVhY3RET00ucmVuZGVyKFxuICAgIDxCZW5jaG1hcmtzVmlld1xuICAgICAgICBiZW5jaG1hcmtzPXt3aW5kb3cubWFwYm94Z2xCZW5jaG1hcmtzfVxuICAgICAgICBiZW5jaG1hcmtGaWx0ZXI9e2Z1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBuYW1lRmlsdGVyID0gd2luZG93LmxvY2F0aW9uLmhhc2guc3Vic3RyKDEpO1xuICAgICAgICAgICAgcmV0dXJuICFuYW1lRmlsdGVyIHx8IG5hbWUgPT09IG5hbWVGaWx0ZXI7XG4gICAgICAgIH19XG4gICAgLz4sXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JlbmNobWFya3MnKVxuKTtcblxuZnVuY3Rpb24gYXN5bmNTZXJpZXMoYXJyYXksIGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgIGlmIChhcnJheS5sZW5ndGgpIHtcbiAgICAgICAgaXRlcmF0b3IoYXJyYXlbMF0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgaWYgKGVycikgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIGVsc2UgYXN5bmNTZXJpZXMoYXJyYXkuc2xpY2UoMSksIGl0ZXJhdG9yLCBjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxufVxuIiwiKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKFsnbW9kdWxlJywgJ3NlbGVjdCddLCBmYWN0b3J5KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIGZhY3RvcnkobW9kdWxlLCByZXF1aXJlKCdzZWxlY3QnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG1vZCA9IHtcbiAgICAgICAgICAgIGV4cG9ydHM6IHt9XG4gICAgICAgIH07XG4gICAgICAgIGZhY3RvcnkobW9kLCBnbG9iYWwuc2VsZWN0KTtcbiAgICAgICAgZ2xvYmFsLmNsaXBib2FyZEFjdGlvbiA9IG1vZC5leHBvcnRzO1xuICAgIH1cbn0pKHRoaXMsIGZ1bmN0aW9uIChtb2R1bGUsIF9zZWxlY3QpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgX3NlbGVjdDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9zZWxlY3QpO1xuXG4gICAgZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHtcbiAgICAgICAgICAgIGRlZmF1bHQ6IG9ialxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqO1xuICAgIH0gOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHtcbiAgICAgICAgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgX2NyZWF0ZUNsYXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldO1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuICAgICAgICAgICAgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcbiAgICAgICAgICAgIGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpO1xuICAgICAgICAgICAgcmV0dXJuIENvbnN0cnVjdG9yO1xuICAgICAgICB9O1xuICAgIH0oKTtcblxuICAgIHZhciBDbGlwYm9hcmRBY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAgICAgKi9cblxuICAgICAgICBmdW5jdGlvbiBDbGlwYm9hcmRBY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIENsaXBib2FyZEFjdGlvbik7XG5cbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgICAgICB0aGlzLmluaXRTZWxlY3Rpb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWZpbmVzIGJhc2UgcHJvcGVydGllcyBwYXNzZWQgZnJvbSBjb25zdHJ1Y3Rvci5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgICAgICovXG5cblxuICAgICAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLnJlc29sdmVPcHRpb25zID0gZnVuY3Rpb24gcmVzb2x2ZU9wdGlvbnMoKSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG4gICAgICAgICAgICB0aGlzLmFjdGlvbiA9IG9wdGlvbnMuYWN0aW9uO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyID0gb3B0aW9ucy5lbWl0dGVyO1xuICAgICAgICAgICAgdGhpcy50YXJnZXQgPSBvcHRpb25zLnRhcmdldDtcbiAgICAgICAgICAgIHRoaXMudGV4dCA9IG9wdGlvbnMudGV4dDtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlciA9IG9wdGlvbnMudHJpZ2dlcjtcblxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZFRleHQgPSAnJztcbiAgICAgICAgfTtcblxuICAgICAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLmluaXRTZWxlY3Rpb24gPSBmdW5jdGlvbiBpbml0U2VsZWN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMudGV4dCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0RmFrZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnRhcmdldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0VGFyZ2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5zZWxlY3RGYWtlID0gZnVuY3Rpb24gc2VsZWN0RmFrZSgpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgICAgICAgIHZhciBpc1JUTCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RpcicpID09ICdydGwnO1xuXG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZha2UoKTtcblxuICAgICAgICAgICAgdGhpcy5mYWtlSGFuZGxlckNhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfdGhpcy5yZW1vdmVGYWtlKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5mYWtlSGFuZGxlciA9IGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmZha2VIYW5kbGVyQ2FsbGJhY2spIHx8IHRydWU7XG5cbiAgICAgICAgICAgIHRoaXMuZmFrZUVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuICAgICAgICAgICAgLy8gUHJldmVudCB6b29taW5nIG9uIGlPU1xuICAgICAgICAgICAgdGhpcy5mYWtlRWxlbS5zdHlsZS5mb250U2l6ZSA9ICcxMnB0JztcbiAgICAgICAgICAgIC8vIFJlc2V0IGJveCBtb2RlbFxuICAgICAgICAgICAgdGhpcy5mYWtlRWxlbS5zdHlsZS5ib3JkZXIgPSAnMCc7XG4gICAgICAgICAgICB0aGlzLmZha2VFbGVtLnN0eWxlLnBhZGRpbmcgPSAnMCc7XG4gICAgICAgICAgICB0aGlzLmZha2VFbGVtLnN0eWxlLm1hcmdpbiA9ICcwJztcbiAgICAgICAgICAgIC8vIE1vdmUgZWxlbWVudCBvdXQgb2Ygc2NyZWVuIGhvcml6b250YWxseVxuICAgICAgICAgICAgdGhpcy5mYWtlRWxlbS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgICAgICB0aGlzLmZha2VFbGVtLnN0eWxlW2lzUlRMID8gJ3JpZ2h0JyA6ICdsZWZ0J10gPSAnLTk5OTlweCc7XG4gICAgICAgICAgICAvLyBNb3ZlIGVsZW1lbnQgdG8gdGhlIHNhbWUgcG9zaXRpb24gdmVydGljYWxseVxuICAgICAgICAgICAgdGhpcy5mYWtlRWxlbS5zdHlsZS50b3AgPSAod2luZG93LnBhZ2VZT2Zmc2V0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3ApICsgJ3B4JztcbiAgICAgICAgICAgIHRoaXMuZmFrZUVsZW0uc2V0QXR0cmlidXRlKCdyZWFkb25seScsICcnKTtcbiAgICAgICAgICAgIHRoaXMuZmFrZUVsZW0udmFsdWUgPSB0aGlzLnRleHQ7XG5cbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5mYWtlRWxlbSk7XG5cbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRUZXh0ID0gKDAsIF9zZWxlY3QyLmRlZmF1bHQpKHRoaXMuZmFrZUVsZW0pO1xuICAgICAgICAgICAgdGhpcy5jb3B5VGV4dCgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUucmVtb3ZlRmFrZSA9IGZ1bmN0aW9uIHJlbW92ZUZha2UoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5mYWtlSGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmZha2VIYW5kbGVyQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIHRoaXMuZmFrZUhhbmRsZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZmFrZUhhbmRsZXJDYWxsYmFjayA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmZha2VFbGVtKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0aGlzLmZha2VFbGVtKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZha2VFbGVtID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLnNlbGVjdFRhcmdldCA9IGZ1bmN0aW9uIHNlbGVjdFRhcmdldCgpIHtcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRUZXh0ID0gKDAsIF9zZWxlY3QyLmRlZmF1bHQpKHRoaXMudGFyZ2V0KTtcbiAgICAgICAgICAgIHRoaXMuY29weVRleHQoKTtcbiAgICAgICAgfTtcblxuICAgICAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLmNvcHlUZXh0ID0gZnVuY3Rpb24gY29weVRleHQoKSB7XG4gICAgICAgICAgICB2YXIgc3VjY2VlZGVkID0gdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHN1Y2NlZWRlZCA9IGRvY3VtZW50LmV4ZWNDb21tYW5kKHRoaXMuYWN0aW9uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIHN1Y2NlZWRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmhhbmRsZVJlc3VsdChzdWNjZWVkZWQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUuaGFuZGxlUmVzdWx0ID0gZnVuY3Rpb24gaGFuZGxlUmVzdWx0KHN1Y2NlZWRlZCkge1xuICAgICAgICAgICAgaWYgKHN1Y2NlZWRlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KCdzdWNjZXNzJywge1xuICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHRoaXMuYWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICB0ZXh0OiB0aGlzLnNlbGVjdGVkVGV4dCxcbiAgICAgICAgICAgICAgICAgICAgdHJpZ2dlcjogdGhpcy50cmlnZ2VyLFxuICAgICAgICAgICAgICAgICAgICBjbGVhclNlbGVjdGlvbjogdGhpcy5jbGVhclNlbGVjdGlvbi5iaW5kKHRoaXMpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KCdlcnJvcicsIHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB0aGlzLmFjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgdHJpZ2dlcjogdGhpcy50cmlnZ2VyLFxuICAgICAgICAgICAgICAgICAgICBjbGVhclNlbGVjdGlvbjogdGhpcy5jbGVhclNlbGVjdGlvbi5iaW5kKHRoaXMpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5jbGVhclNlbGVjdGlvbiA9IGZ1bmN0aW9uIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy50YXJnZXQuYmx1cigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aW5kb3cuZ2V0U2VsZWN0aW9uKCkucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gZGVzdHJveSgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRmFrZSgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIF9jcmVhdGVDbGFzcyhDbGlwYm9hcmRBY3Rpb24sIFt7XG4gICAgICAgICAgICBrZXk6ICdhY3Rpb24nLFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFjdGlvbiA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/ICdjb3B5JyA6IGFyZ3VtZW50c1swXTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2FjdGlvbiA9IGFjdGlvbjtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hY3Rpb24gIT09ICdjb3B5JyAmJiB0aGlzLl9hY3Rpb24gIT09ICdjdXQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBcImFjdGlvblwiIHZhbHVlLCB1c2UgZWl0aGVyIFwiY29weVwiIG9yIFwiY3V0XCInKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwge1xuICAgICAgICAgICAga2V5OiAndGFyZ2V0JyxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gc2V0KHRhcmdldCkge1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ICYmICh0eXBlb2YgdGFyZ2V0ID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih0YXJnZXQpKSA9PT0gJ29iamVjdCcgJiYgdGFyZ2V0Lm5vZGVUeXBlID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5hY3Rpb24gPT09ICdjb3B5JyAmJiB0YXJnZXQuaGFzQXR0cmlidXRlKCdkaXNhYmxlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFwidGFyZ2V0XCIgYXR0cmlidXRlLiBQbGVhc2UgdXNlIFwicmVhZG9ubHlcIiBpbnN0ZWFkIG9mIFwiZGlzYWJsZWRcIiBhdHRyaWJ1dGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuYWN0aW9uID09PSAnY3V0JyAmJiAodGFyZ2V0Lmhhc0F0dHJpYnV0ZSgncmVhZG9ubHknKSB8fCB0YXJnZXQuaGFzQXR0cmlidXRlKCdkaXNhYmxlZCcpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBcInRhcmdldFwiIGF0dHJpYnV0ZS4gWW91IGNhblxcJ3QgY3V0IHRleHQgZnJvbSBlbGVtZW50cyB3aXRoIFwicmVhZG9ubHlcIiBvciBcImRpc2FibGVkXCIgYXR0cmlidXRlcycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl90YXJnZXQgPSB0YXJnZXQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgXCJ0YXJnZXRcIiB2YWx1ZSwgdXNlIGEgdmFsaWQgRWxlbWVudCcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl90YXJnZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1dKTtcblxuICAgICAgICByZXR1cm4gQ2xpcGJvYXJkQWN0aW9uO1xuICAgIH0oKTtcblxuICAgIG1vZHVsZS5leHBvcnRzID0gQ2xpcGJvYXJkQWN0aW9uO1xufSk7IiwiKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKFsnbW9kdWxlJywgJy4vY2xpcGJvYXJkLWFjdGlvbicsICd0aW55LWVtaXR0ZXInLCAnZ29vZC1saXN0ZW5lciddLCBmYWN0b3J5KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIGZhY3RvcnkobW9kdWxlLCByZXF1aXJlKCcuL2NsaXBib2FyZC1hY3Rpb24nKSwgcmVxdWlyZSgndGlueS1lbWl0dGVyJyksIHJlcXVpcmUoJ2dvb2QtbGlzdGVuZXInKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG1vZCA9IHtcbiAgICAgICAgICAgIGV4cG9ydHM6IHt9XG4gICAgICAgIH07XG4gICAgICAgIGZhY3RvcnkobW9kLCBnbG9iYWwuY2xpcGJvYXJkQWN0aW9uLCBnbG9iYWwudGlueUVtaXR0ZXIsIGdsb2JhbC5nb29kTGlzdGVuZXIpO1xuICAgICAgICBnbG9iYWwuY2xpcGJvYXJkID0gbW9kLmV4cG9ydHM7XG4gICAgfVxufSkodGhpcywgZnVuY3Rpb24gKG1vZHVsZSwgX2NsaXBib2FyZEFjdGlvbiwgX3RpbnlFbWl0dGVyLCBfZ29vZExpc3RlbmVyKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIF9jbGlwYm9hcmRBY3Rpb24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY2xpcGJvYXJkQWN0aW9uKTtcblxuICAgIHZhciBfdGlueUVtaXR0ZXIyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfdGlueUVtaXR0ZXIpO1xuXG4gICAgdmFyIF9nb29kTGlzdGVuZXIyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZ29vZExpc3RlbmVyKTtcblxuICAgIGZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7XG4gICAgICAgICAgICBkZWZhdWx0OiBvYmpcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7XG4gICAgICAgIGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3Bvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4oc2VsZiwgY2FsbCkge1xuICAgICAgICBpZiAoIXNlbGYpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcInRoaXMgaGFzbid0IGJlZW4gaW5pdGlhbGlzZWQgLSBzdXBlcigpIGhhc24ndCBiZWVuIGNhbGxlZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjYWxsICYmICh0eXBlb2YgY2FsbCA9PT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgY2FsbCA9PT0gXCJmdW5jdGlvblwiKSA/IGNhbGwgOiBzZWxmO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pbmhlcml0cyhzdWJDbGFzcywgc3VwZXJDbGFzcykge1xuICAgICAgICBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09IFwiZnVuY3Rpb25cIiAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCBcIiArIHR5cGVvZiBzdXBlckNsYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwge1xuICAgICAgICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogc3ViQ2xhc3MsXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7XG4gICAgfVxuXG4gICAgdmFyIENsaXBib2FyZCA9IGZ1bmN0aW9uIChfRW1pdHRlcikge1xuICAgICAgICBfaW5oZXJpdHMoQ2xpcGJvYXJkLCBfRW1pdHRlcik7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfEhUTUxFbGVtZW50fEhUTUxDb2xsZWN0aW9ufE5vZGVMaXN0fSB0cmlnZ2VyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICAgICAqL1xuXG4gICAgICAgIGZ1bmN0aW9uIENsaXBib2FyZCh0cmlnZ2VyLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgQ2xpcGJvYXJkKTtcblxuICAgICAgICAgICAgdmFyIF90aGlzID0gX3Bvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4odGhpcywgX0VtaXR0ZXIuY2FsbCh0aGlzKSk7XG5cbiAgICAgICAgICAgIF90aGlzLnJlc29sdmVPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICAgICAgX3RoaXMubGlzdGVuQ2xpY2sodHJpZ2dlcik7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmaW5lcyBpZiBhdHRyaWJ1dGVzIHdvdWxkIGJlIHJlc29sdmVkIHVzaW5nIGludGVybmFsIHNldHRlciBmdW5jdGlvbnNcbiAgICAgICAgICogb3IgY3VzdG9tIGZ1bmN0aW9ucyB0aGF0IHdlcmUgcGFzc2VkIGluIHRoZSBjb25zdHJ1Y3Rvci5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgICAgICovXG5cblxuICAgICAgICBDbGlwYm9hcmQucHJvdG90eXBlLnJlc29sdmVPcHRpb25zID0gZnVuY3Rpb24gcmVzb2x2ZU9wdGlvbnMoKSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG4gICAgICAgICAgICB0aGlzLmFjdGlvbiA9IHR5cGVvZiBvcHRpb25zLmFjdGlvbiA9PT0gJ2Z1bmN0aW9uJyA/IG9wdGlvbnMuYWN0aW9uIDogdGhpcy5kZWZhdWx0QWN0aW9uO1xuICAgICAgICAgICAgdGhpcy50YXJnZXQgPSB0eXBlb2Ygb3B0aW9ucy50YXJnZXQgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zLnRhcmdldCA6IHRoaXMuZGVmYXVsdFRhcmdldDtcbiAgICAgICAgICAgIHRoaXMudGV4dCA9IHR5cGVvZiBvcHRpb25zLnRleHQgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zLnRleHQgOiB0aGlzLmRlZmF1bHRUZXh0O1xuICAgICAgICB9O1xuXG4gICAgICAgIENsaXBib2FyZC5wcm90b3R5cGUubGlzdGVuQ2xpY2sgPSBmdW5jdGlvbiBsaXN0ZW5DbGljayh0cmlnZ2VyKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgICAgICAgdGhpcy5saXN0ZW5lciA9ICgwLCBfZ29vZExpc3RlbmVyMi5kZWZhdWx0KSh0cmlnZ2VyLCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfdGhpczIub25DbGljayhlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIENsaXBib2FyZC5wcm90b3R5cGUub25DbGljayA9IGZ1bmN0aW9uIG9uQ2xpY2soZSkge1xuICAgICAgICAgICAgdmFyIHRyaWdnZXIgPSBlLmRlbGVnYXRlVGFyZ2V0IHx8IGUuY3VycmVudFRhcmdldDtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY2xpcGJvYXJkQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGlwYm9hcmRBY3Rpb24gPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmNsaXBib2FyZEFjdGlvbiA9IG5ldyBfY2xpcGJvYXJkQWN0aW9uMi5kZWZhdWx0KHtcbiAgICAgICAgICAgICAgICBhY3Rpb246IHRoaXMuYWN0aW9uKHRyaWdnZXIpLFxuICAgICAgICAgICAgICAgIHRhcmdldDogdGhpcy50YXJnZXQodHJpZ2dlciksXG4gICAgICAgICAgICAgICAgdGV4dDogdGhpcy50ZXh0KHRyaWdnZXIpLFxuICAgICAgICAgICAgICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgICAgICAgICAgICAgZW1pdHRlcjogdGhpc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgQ2xpcGJvYXJkLnByb3RvdHlwZS5kZWZhdWx0QWN0aW9uID0gZnVuY3Rpb24gZGVmYXVsdEFjdGlvbih0cmlnZ2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0QXR0cmlidXRlVmFsdWUoJ2FjdGlvbicsIHRyaWdnZXIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIENsaXBib2FyZC5wcm90b3R5cGUuZGVmYXVsdFRhcmdldCA9IGZ1bmN0aW9uIGRlZmF1bHRUYXJnZXQodHJpZ2dlcikge1xuICAgICAgICAgICAgdmFyIHNlbGVjdG9yID0gZ2V0QXR0cmlidXRlVmFsdWUoJ3RhcmdldCcsIHRyaWdnZXIpO1xuXG4gICAgICAgICAgICBpZiAoc2VsZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgQ2xpcGJvYXJkLnByb3RvdHlwZS5kZWZhdWx0VGV4dCA9IGZ1bmN0aW9uIGRlZmF1bHRUZXh0KHRyaWdnZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRBdHRyaWJ1dGVWYWx1ZSgndGV4dCcsIHRyaWdnZXIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIENsaXBib2FyZC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVyLmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY2xpcGJvYXJkQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGlwYm9hcmRBY3Rpb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2xpcGJvYXJkQWN0aW9uID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gQ2xpcGJvYXJkO1xuICAgIH0oX3RpbnlFbWl0dGVyMi5kZWZhdWx0KTtcblxuICAgIC8qKlxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byByZXRyaWV2ZSBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN1ZmZpeFxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZWxlbWVudFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldEF0dHJpYnV0ZVZhbHVlKHN1ZmZpeCwgZWxlbWVudCkge1xuICAgICAgICB2YXIgYXR0cmlidXRlID0gJ2RhdGEtY2xpcGJvYXJkLScgKyBzdWZmaXg7XG5cbiAgICAgICAgaWYgKCFlbGVtZW50Lmhhc0F0dHJpYnV0ZShhdHRyaWJ1dGUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlKTtcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IENsaXBib2FyZDtcbn0pOyIsInZhciBtYXRjaGVzID0gcmVxdWlyZSgnbWF0Y2hlcy1zZWxlY3RvcicpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChlbGVtZW50LCBzZWxlY3RvciwgY2hlY2tZb1NlbGYpIHtcclxuICB2YXIgcGFyZW50ID0gY2hlY2tZb1NlbGYgPyBlbGVtZW50IDogZWxlbWVudC5wYXJlbnROb2RlXHJcblxyXG4gIHdoaWxlIChwYXJlbnQgJiYgcGFyZW50ICE9PSBkb2N1bWVudCkge1xyXG4gICAgaWYgKG1hdGNoZXMocGFyZW50LCBzZWxlY3RvcikpIHJldHVybiBwYXJlbnQ7XHJcbiAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZVxyXG4gIH1cclxufVxyXG4iLCJcclxuLyoqXHJcbiAqIEVsZW1lbnQgcHJvdG90eXBlLlxyXG4gKi9cclxuXHJcbnZhciBwcm90byA9IEVsZW1lbnQucHJvdG90eXBlO1xyXG5cclxuLyoqXHJcbiAqIFZlbmRvciBmdW5jdGlvbi5cclxuICovXHJcblxyXG52YXIgdmVuZG9yID0gcHJvdG8ubWF0Y2hlc1NlbGVjdG9yXHJcbiAgfHwgcHJvdG8ud2Via2l0TWF0Y2hlc1NlbGVjdG9yXHJcbiAgfHwgcHJvdG8ubW96TWF0Y2hlc1NlbGVjdG9yXHJcbiAgfHwgcHJvdG8ubXNNYXRjaGVzU2VsZWN0b3JcclxuICB8fCBwcm90by5vTWF0Y2hlc1NlbGVjdG9yO1xyXG5cclxuLyoqXHJcbiAqIEV4cG9zZSBgbWF0Y2goKWAuXHJcbiAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBtYXRjaDtcclxuXHJcbi8qKlxyXG4gKiBNYXRjaCBgZWxgIHRvIGBzZWxlY3RvcmAuXHJcbiAqXHJcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcclxuICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XHJcbiAqIEBhcGkgcHVibGljXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gbWF0Y2goZWwsIHNlbGVjdG9yKSB7XHJcbiAgaWYgKHZlbmRvcikgcmV0dXJuIHZlbmRvci5jYWxsKGVsLCBzZWxlY3Rvcik7XHJcbiAgdmFyIG5vZGVzID0gZWwucGFyZW50Tm9kZS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcclxuICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgKytpKSB7XHJcbiAgICBpZiAobm9kZXNbaV0gPT0gZWwpIHJldHVybiB0cnVlO1xyXG4gIH1cclxuICByZXR1cm4gZmFsc2U7XHJcbn0iLCJ2YXIgY2xvc2VzdCA9IHJlcXVpcmUoJ2Nsb3Nlc3QnKTtcblxuLyoqXG4gKiBEZWxlZ2F0ZXMgZXZlbnQgdG8gYSBzZWxlY3Rvci5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHVzZUNhcHR1cmVcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gZGVsZWdhdGUoZWxlbWVudCwgc2VsZWN0b3IsIHR5cGUsIGNhbGxiYWNrLCB1c2VDYXB0dXJlKSB7XG4gICAgdmFyIGxpc3RlbmVyRm4gPSBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGxpc3RlbmVyRm4sIHVzZUNhcHR1cmUpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZGVzdHJveTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXJGbiwgdXNlQ2FwdHVyZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogRmluZHMgY2xvc2VzdCBtYXRjaCBhbmQgaW52b2tlcyBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuZnVuY3Rpb24gbGlzdGVuZXIoZWxlbWVudCwgc2VsZWN0b3IsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5kZWxlZ2F0ZVRhcmdldCA9IGNsb3Nlc3QoZS50YXJnZXQsIHNlbGVjdG9yLCB0cnVlKTtcblxuICAgICAgICBpZiAoZS5kZWxlZ2F0ZVRhcmdldCkge1xuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChlbGVtZW50LCBlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWxlZ2F0ZTtcbiIsIi8qKlxuICogQ2hlY2sgaWYgYXJndW1lbnQgaXMgYSBIVE1MIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5leHBvcnRzLm5vZGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkXG4gICAgICAgICYmIHZhbHVlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnRcbiAgICAgICAgJiYgdmFsdWUubm9kZVR5cGUgPT09IDE7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGFyZ3VtZW50IGlzIGEgbGlzdCBvZiBIVE1MIGVsZW1lbnRzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuZXhwb3J0cy5ub2RlTGlzdCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHR5cGUgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuXG4gICAgcmV0dXJuIHZhbHVlICE9PSB1bmRlZmluZWRcbiAgICAgICAgJiYgKHR5cGUgPT09ICdbb2JqZWN0IE5vZGVMaXN0XScgfHwgdHlwZSA9PT0gJ1tvYmplY3QgSFRNTENvbGxlY3Rpb25dJylcbiAgICAgICAgJiYgKCdsZW5ndGgnIGluIHZhbHVlKVxuICAgICAgICAmJiAodmFsdWUubGVuZ3RoID09PSAwIHx8IGV4cG9ydHMubm9kZSh2YWx1ZVswXSkpO1xufTtcblxuLyoqXG4gKiBDaGVjayBpZiBhcmd1bWVudCBpcyBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuc3RyaW5nID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJ1xuICAgICAgICB8fCB2YWx1ZSBpbnN0YW5jZW9mIFN0cmluZztcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgYXJndW1lbnQgaXMgYSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuZm4gPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciB0eXBlID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcblxuICAgIHJldHVybiB0eXBlID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufTtcbiIsInZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoJ2RlbGVnYXRlJyk7XG5cbi8qKlxuICogVmFsaWRhdGVzIGFsbCBwYXJhbXMgYW5kIGNhbGxzIHRoZSByaWdodFxuICogbGlzdGVuZXIgZnVuY3Rpb24gYmFzZWQgb24gaXRzIHRhcmdldCB0eXBlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfEhUTUxFbGVtZW50fEhUTUxDb2xsZWN0aW9ufE5vZGVMaXN0fSB0YXJnZXRcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5mdW5jdGlvbiBsaXN0ZW4odGFyZ2V0LCB0eXBlLCBjYWxsYmFjaykge1xuICAgIGlmICghdGFyZ2V0ICYmICF0eXBlICYmICFjYWxsYmFjaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgYXJndW1lbnRzJyk7XG4gICAgfVxuXG4gICAgaWYgKCFpcy5zdHJpbmcodHlwZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IG11c3QgYmUgYSBTdHJpbmcnKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzLmZuKGNhbGxiYWNrKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGlyZCBhcmd1bWVudCBtdXN0IGJlIGEgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBpZiAoaXMubm9kZSh0YXJnZXQpKSB7XG4gICAgICAgIHJldHVybiBsaXN0ZW5Ob2RlKHRhcmdldCwgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIGlmIChpcy5ub2RlTGlzdCh0YXJnZXQpKSB7XG4gICAgICAgIHJldHVybiBsaXN0ZW5Ob2RlTGlzdCh0YXJnZXQsIHR5cGUsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXMuc3RyaW5nKHRhcmdldCkpIHtcbiAgICAgICAgcmV0dXJuIGxpc3RlblNlbGVjdG9yKHRhcmdldCwgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIFN0cmluZywgSFRNTEVsZW1lbnQsIEhUTUxDb2xsZWN0aW9uLCBvciBOb2RlTGlzdCcpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBBZGRzIGFuIGV2ZW50IGxpc3RlbmVyIHRvIGEgSFRNTCBlbGVtZW50XG4gKiBhbmQgcmV0dXJucyBhIHJlbW92ZSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gbGlzdGVuTm9kZShub2RlLCB0eXBlLCBjYWxsYmFjaykge1xuICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQWRkIGFuIGV2ZW50IGxpc3RlbmVyIHRvIGEgbGlzdCBvZiBIVE1MIGVsZW1lbnRzXG4gKiBhbmQgcmV0dXJucyBhIHJlbW92ZSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge05vZGVMaXN0fEhUTUxDb2xsZWN0aW9ufSBub2RlTGlzdFxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGxpc3Rlbk5vZGVMaXN0KG5vZGVMaXN0LCB0eXBlLCBjYWxsYmFjaykge1xuICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwobm9kZUxpc3QsIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChub2RlTGlzdCwgZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXIgdG8gYSBzZWxlY3RvclxuICogYW5kIHJldHVybnMgYSByZW1vdmUgbGlzdGVuZXIgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gbGlzdGVuU2VsZWN0b3Ioc2VsZWN0b3IsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGRlbGVnYXRlKGRvY3VtZW50LmJvZHksIHNlbGVjdG9yLCB0eXBlLCBjYWxsYmFjayk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdGVuO1xuIiwiZnVuY3Rpb24gc2VsZWN0KGVsZW1lbnQpIHtcbiAgICB2YXIgc2VsZWN0ZWRUZXh0O1xuXG4gICAgaWYgKGVsZW1lbnQubm9kZU5hbWUgPT09ICdJTlBVVCcgfHwgZWxlbWVudC5ub2RlTmFtZSA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgICBlbGVtZW50LmZvY3VzKCk7XG4gICAgICAgIGVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UoMCwgZWxlbWVudC52YWx1ZS5sZW5ndGgpO1xuXG4gICAgICAgIHNlbGVjdGVkVGV4dCA9IGVsZW1lbnQudmFsdWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ2NvbnRlbnRlZGl0YWJsZScpKSB7XG4gICAgICAgICAgICBlbGVtZW50LmZvY3VzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuICAgICAgICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xuXG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGVDb250ZW50cyhlbGVtZW50KTtcbiAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgICAgICBzZWxlY3Rpb24uYWRkUmFuZ2UocmFuZ2UpO1xuXG4gICAgICAgIHNlbGVjdGVkVGV4dCA9IHNlbGVjdGlvbi50b1N0cmluZygpO1xuICAgIH1cblxuICAgIHJldHVybiBzZWxlY3RlZFRleHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2VsZWN0O1xuIiwiZnVuY3Rpb24gRSAoKSB7XG4gIC8vIEtlZXAgdGhpcyBlbXB0eSBzbyBpdCdzIGVhc2llciB0byBpbmhlcml0IGZyb21cbiAgLy8gKHZpYSBodHRwczovL2dpdGh1Yi5jb20vbGlwc21hY2sgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vc2NvdHRjb3JnYW4vdGlueS1lbWl0dGVyL2lzc3Vlcy8zKVxufVxuXG5FLnByb3RvdHlwZSA9IHtcbiAgb246IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaywgY3R4KSB7XG4gICAgdmFyIGUgPSB0aGlzLmUgfHwgKHRoaXMuZSA9IHt9KTtcblxuICAgIChlW25hbWVdIHx8IChlW25hbWVdID0gW10pKS5wdXNoKHtcbiAgICAgIGZuOiBjYWxsYmFjayxcbiAgICAgIGN0eDogY3R4XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBvbmNlOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2ssIGN0eCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmdW5jdGlvbiBsaXN0ZW5lciAoKSB7XG4gICAgICBzZWxmLm9mZihuYW1lLCBsaXN0ZW5lcik7XG4gICAgICBjYWxsYmFjay5hcHBseShjdHgsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIGxpc3RlbmVyLl8gPSBjYWxsYmFja1xuICAgIHJldHVybiB0aGlzLm9uKG5hbWUsIGxpc3RlbmVyLCBjdHgpO1xuICB9LFxuXG4gIGVtaXQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdmFyIGRhdGEgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgdmFyIGV2dEFyciA9ICgodGhpcy5lIHx8ICh0aGlzLmUgPSB7fSkpW25hbWVdIHx8IFtdKS5zbGljZSgpO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbGVuID0gZXZ0QXJyLmxlbmd0aDtcblxuICAgIGZvciAoaTsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBldnRBcnJbaV0uZm4uYXBwbHkoZXZ0QXJyW2ldLmN0eCwgZGF0YSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgb2ZmOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcbiAgICB2YXIgZSA9IHRoaXMuZSB8fCAodGhpcy5lID0ge30pO1xuICAgIHZhciBldnRzID0gZVtuYW1lXTtcbiAgICB2YXIgbGl2ZUV2ZW50cyA9IFtdO1xuXG4gICAgaWYgKGV2dHMgJiYgY2FsbGJhY2spIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBldnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGlmIChldnRzW2ldLmZuICE9PSBjYWxsYmFjayAmJiBldnRzW2ldLmZuLl8gIT09IGNhbGxiYWNrKVxuICAgICAgICAgIGxpdmVFdmVudHMucHVzaChldnRzW2ldKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZXZlbnQgZnJvbSBxdWV1ZSB0byBwcmV2ZW50IG1lbW9yeSBsZWFrXG4gICAgLy8gU3VnZ2VzdGVkIGJ5IGh0dHBzOi8vZ2l0aHViLmNvbS9sYXpkXG4gICAgLy8gUmVmOiBodHRwczovL2dpdGh1Yi5jb20vc2NvdHRjb3JnYW4vdGlueS1lbWl0dGVyL2NvbW1pdC9jNmViZmFhOWJjOTczYjMzZDExMGE4NGEzMDc3NDJiN2NmOTRjOTUzI2NvbW1pdGNvbW1lbnQtNTAyNDkxMFxuXG4gICAgKGxpdmVFdmVudHMubGVuZ3RoKVxuICAgICAgPyBlW25hbWVdID0gbGl2ZUV2ZW50c1xuICAgICAgOiBkZWxldGUgZVtuYW1lXTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEU7XG4iXX0=
