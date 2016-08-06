'use strict';

var assert = require('assert');
var WebWorker = require('./web_worker');

module.exports = WorkerPool;

function WorkerPool() {
    this.workers = [];
    this.active = {};
}

WorkerPool.prototype = {
    acquire: function (mapId, workerCount) {
        this._resize(workerCount);
        this.active[mapId] = workerCount;
        return this.workers.slice(0, workerCount);
    },

    release: function (mapId) {
        delete this.active[mapId];
        if (Object.keys(this.active).length === 0) {
            this.workers.forEach(function (w) { w.terminate(); });
            this.workers = [];
        }
    },

    _resize: function (len) {
        assert(typeof len === 'number');
        while (this.workers.length < len) {
            this.workers.push(new WebWorker());
        }
    }
};

