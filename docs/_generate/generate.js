// GL style reference generator

var fs = require('fs'),
    path = require('path'),
    marked = require('marked'),
    _ = require('underscore');

var index = _.template(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8'));

var renderer = new marked.Renderer(),
	heading = {},
	toc = '';

renderer.heading = function(text, level) {
	var escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
	heading[level] = escapedText;
	var id = level > 2 ? heading[level-1]+'-'+escapedText : escapedText;

    // Remove new, function args from TOC test.
    var title = text.replace(/^new /, '').replace(/\([^\)]*\)/, '');

	if (level === 2) {
		toc = toc+'  - title: '+title+'\n    url: /api\n    id: '+id+'\n    subnav:\n';
	} else if (level >= 3) {
		toc = toc+'    - title: '+title+'\n      url: /api\n      id: '+id+'\n';
	}

	return '<h'+level+' id="'+id+'">'+text+'</h'+level+'>';
};

renderer.code = function(code, lang) {
	return '{% highlight '+lang+' %}'+code+'\n{% endhighlight %}\n';
}

var api = marked(
	fs.readFileSync(path.join(__dirname, '../../API.md'), 'utf-8'),
	{renderer: renderer}
);

fs.writeFileSync(path.join(__dirname, '../_posts/3400-01-01-api.html'), index({
  api: api,
  toc: toc
}));
