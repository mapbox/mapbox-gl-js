'use strict';

var test = require('prova');
var config = require('../../../js/util/config');

test('config', function(t) {
    t.test('ACCESS_TOKEN', function(t) {
        config.once('token.change', function (e) {
            t.equal('tk.abc.xyz', e.token);
            t.equal('tk.abc.xyz', config.ACCESS_TOKEN);

            t.end();
        });

        config.ACCESS_TOKEN = 'tk.abc.xyz';
    });

    t.end();
});
