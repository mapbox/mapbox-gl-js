'use strict';

exports.create = function (tagName, className, container) {
	var el = document.createElement(tagName);
	if (className) el.className = className;
	if (container) container.appendChild(el);
	return el;
};
