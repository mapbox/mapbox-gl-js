import { test } from 'mapbox-gl-js-test';
import Actor from '../../../src/util/actor';
import WebWorker from '../../../src/util/web_worker';

test('Actor', (t) => {
    t.test('forwards resopnses to correct callback', (t) => {
        t.stub(WebWorker, 'Worker').callsFake(function Worker(self) {
            this.self = self;
            this.actor = new Actor(self, this);
            this.test = function (mapId, params, callback) {
                setTimeout(callback, 0, null, params);
            };
        });

        const worker = new WebWorker();

        const m1 = new Actor(worker, {}, 'map-1');
        const m2 = new Actor(worker, {}, 'map-2');

        t.plan(4);
        m1.send('test', { value: 1729 }, (err, response) => {
            t.error(err);
            t.same(response, { value: 1729 });
        });
        m2.send('test', { value: 4104 }, (err, response) => {
            t.error(err);
            t.same(response, { value: 4104 });
        });
    });

    t.test('targets worker-initiated messages to correct map instance', (t) => {
        let workerActor;

        t.stub(WebWorker, 'Worker').callsFake(function Worker(self) {
            this.self = self;
            this.actor = workerActor = new Actor(self, this);
        });

        const worker = new WebWorker();

        new Actor(worker, {
            test: function () { t.end(); }
        }, 'map-1');
        new Actor(worker, {
            test: function () {
                t.fail();
                t.end();
            }
        }, 'map-2');

        workerActor.send('test', {}, () => {}, 'map-1');
    });

    t.test('#remove unbinds event listener', (t) => {
        const actor = new Actor({
            addEventListener: function (type, callback, useCapture) {
                this._addEventListenerArgs = [type, callback, useCapture];
            },
            removeEventListener: function (type, callback, useCapture) {
                t.same([type, callback, useCapture], this._addEventListenerArgs, 'listener removed');
                t.end();
            }
        }, {}, null);
        actor.remove();
    });

    t.end();
});
