function StyleList() {
    var list = this;
    this.list = JSON.parse(localStorage['llmr/styles'] || '[]');
    this.active = JSON.parse(localStorage['llmr/selected'] || 'null');
    setTimeout(function() {
        for (var i = 0; i < list.list.length; i++) {
            $(list).trigger('style:add', list.list[i]);
        }
        $(list).trigger('style:load');
    });
}

StyleList.prototype.create = function(template, name) {
    var name = 'llmr/styles/' + (name || randomName(10));
    this.list.push(name);
    localStorage[name] = JSON.stringify(template);
    localStorage['llmr/styles'] = JSON.stringify(this.list);
    $(this).trigger('style:add', name);
    return name;
};

StyleList.prototype.select = function(name) {
    this.active = name;
    localStorage['llmr/selected'] = JSON.stringify(name);
    var style = JSON.parse(localStorage[name]);
    $(this).trigger('style:change', { name: name, style: style });
};

StyleList.prototype.save = function(style) {
    if (this.active) {
        localStorage[this.active] = JSON.stringify(style);
    }
};

StyleList.prototype.remove = function(name) {
    localStorage.removeItem(name);
    var index = this.list.indexOf(name);
    if (index >= 0) this.list.splice(index, 1);
    localStorage['llmr/styles'] = JSON.stringify(this.list);
    var next = this.list[index] || this.list[0];
    if (next) {
        this.select(next);
    } else {
        this.active = null;
        localStorage['llmr/selected'] = JSON.stringify(null);
        $(this).trigger('style:change', { name: null, style: {} });
    }
};


function randomName(length) {
    var name = '';
    for (var i = 0; i < length; i++) {
        name += String.fromCharCode(Math.random() * 26 + 97);
    }
    return name;
}
