'use strict';

var util = require('../../js/util/util');

exports.click = function (element, options) {
    options = util.extend({bubbles: true}, options);
    var MouseEvent = element.ownerDocument.defaultView.MouseEvent;
    element.dispatchEvent(new MouseEvent('mousedown', options));
    element.dispatchEvent(new MouseEvent('mouseup', options));
    element.dispatchEvent(new MouseEvent('click', options));
};
