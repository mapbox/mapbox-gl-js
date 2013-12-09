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

StyleList.prototype.select = function(name, animationLoop) {
    if (assert) assert.ok(typeof animationLoop === 'object', 'AnimationLoop must be an object');

    this.active = name;
    localStorage['llmr/selected'] = JSON.stringify(name);
    var style = new llmr.Style(JSON.parse(localStorage[name]), animationLoop);
    style.on('change', function() {
        localStorage[name] = JSON.stringify(style.stylesheet);
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
