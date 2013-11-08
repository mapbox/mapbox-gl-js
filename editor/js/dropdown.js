
function Dropdown(el) {
    this.root = $(el);
    this.items = [];
}

Dropdown.prototype.add = function(text, key) {
    var dropdown = this;
    var remove;
    var el = $('<li>')
        .append($('<div class="name">').text(text))
        .append(remove = $('<div class="remove icon">'))

    this.items[key] = el;

    this.root.append(el);

    el.click(function() {
        $(dropdown).trigger('item:select', key);
    });

    remove.click(function() {
        el.remove();
        delete dropdown.items[key];
        $(dropdown).trigger('item:remove', key);
        return false;
    });
};

Dropdown.prototype.select = function(key) {
    this.root.find('.active').removeClass('active');
    if (this.items[key]) {
        this.items[key].addClass('active');
    }
};

        // <li class="active">Current</li>
        // <li>Other</li>
        // <li>Third</li>