'use strict';

var assert = llmr.assert;

module.exports = StyleList;
function StyleList() {
    var list = this;
    this.list = JSON.parse(localStorage['llmr/styles'] || '[]');
    this.active = JSON.parse(localStorage['llmr/selected'] || 'null');
    setTimeout(function() {
        for (var i = 0; i < list.list.length; i++) {
            list.fire('add', [list.list[i]]);
        }
        list.fire('load');
    });
}

llmr.evented(StyleList);

StyleList.prototype.create = function(template, name) {
    name = 'llmr/styles/' + name;
    this.list.push(name);
    localStorage[name] = JSON.stringify(template);
    localStorage['llmr/styles'] = JSON.stringify(this.list);
    this.fire('add', [name]);
    return name;
};

function cleanup(obj) {
    if (Array.isArray(obj)) {
        return obj.filter(function(obj) {
            // Filter array elements whose name starts with a double underscore
            return !(typeof obj === 'object' && (typeof obj.name === 'string' && obj.name[0] === '_' && obj.name[1] === '_'));
        }).map(cleanup);
    } else if (typeof obj === 'object') {
        var res = {};
        for (var key in obj) {
            // Filter properties that begin with a double underscore
            if (!(typeof key === 'string' && key[0] === '_' && key[1] === '_')) {
                res[key] = cleanup(obj[key]);
            }
        }
        return res;
    } else {
        return obj;
    }
}

StyleList.prototype.select = function(name, animationLoop) {
    if (assert) assert.ok(typeof animationLoop === 'object', 'AnimationLoop must be an object');

    this.active = name;
    localStorage['llmr/selected'] = JSON.stringify(name);
    var style = new llmr.Style(JSON.parse(localStorage[name]), animationLoop);
    style.on('change', function() {
        // Hack to throw out __xray__ properties
        var stylesheet = cleanup(style.stylesheet);
        localStorage[name] = JSON.stringify(stylesheet);
    });
    this.fire('change', [name, style]);
};

StyleList.prototype.remove = function(name) {
    localStorage.removeItem(name);
    var index = this.list.indexOf(name);
    if (index >= 0) this.list.splice(index, 1);
    localStorage['llmr/styles'] = JSON.stringify(this.list);
    this.active = null;
    localStorage['llmr/selected'] = JSON.stringify(null);
    this.fire('change', [null, null]);
};
