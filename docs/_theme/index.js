'use strict';

var fs = require('fs'),
  path = require('path'),
  File = require('vinyl'),
  vfs = require('vinyl-fs'),
  template = require('lodash.template'),
  concat = require('concat-stream'),
  GithubSlugger = require('github-slugger'),
  createFormatters = require('documentation').util.createFormatters,
  createLinkerStack = require('documentation').util.createLinkerStack,
  hljs = require('highlight.js');

module.exports = function (comments, options, callback) {

  var linkerStack = createLinkerStack(options)
    .namespaceResolver(comments, function (namespace) {
      var slugger = new GithubSlugger();
      return '#' + slugger.slug(namespace);
    });

  var formatters = createFormatters(linkerStack.link);

  hljs.configure(options.hljs || {});

  var imports = {
    shortSignature: function (section, hasSectionName) {
      var prefix = '';
      if (section.kind === 'class') {
        prefix = 'new ';
      }
      if (section.kind !== 'function' && !hasSectionName) {
        return '';
      }
      if (hasSectionName) {
        return prefix + section.name + formatters.parameters(section, true);
      } else if (!hasSectionName && formatters.parameters(section)) {
        return formatters.parameters(section, true);
      } else {
        return '()';
      }
    },
    signature: function (section, hasSectionName) {
      var returns = '';
      var prefix = '';
      if (section.kind === 'class') {
        prefix = 'new ';
      } else if (section.kind !== 'function') {
        return section.name;
      }
      if (section.returns) {
        returns = ': ' +
          formatters.type(section.returns[0].type);
      }
      if (hasSectionName) {
        return prefix + section.name + formatters.parameters(section) + returns;
      } else if (!hasSectionName && formatters.parameters(section)) {
        return section.name + formatters.parameters(section) + returns;
      } else {
        return section.name + '()' + returns;
      }
    },
    md: function (ast, inline) {
      if (inline && ast && ast.children.length && ast.children[0].type === 'paragraph') {
        ast = {
          type: 'root',
          children: ast.children[0].children.concat(ast.children.slice(1))
        };
      }
      return formatters.markdown(ast);
    },
    formatType: formatters.type,
    autolink: formatters.autolink,
    highlight: function (example) {
      if (options.hljs && options.hljs.highlightAuto) {
        return hljs.highlightAuto(example).value;
      }
      return hljs.highlight('js', example).value;
    }
  };

  var pageTemplate = template(fs.readFileSync(path.join(__dirname, 'index.hbs'), 'utf8'), {
    imports: {
      renderSection: template(fs.readFileSync(path.join(__dirname, 'section.hbs'), 'utf8'), {
        imports: imports
      }),
      renderNote: template(fs.readFileSync(path.join(__dirname, 'note.hbs'), 'utf8'), {
        imports: imports
      }),
      renderSectionList: template(fs.readFileSync(path.join(__dirname, 'section_list.hbs'), 'utf8'), {
        imports: imports
      }),
      highlight: function (str) {
        return highlight(str);
      }
    }
  });

  // push assets into the pipeline as well.
  vfs.src([__dirname + '/assets/**'], { base: __dirname })
    .pipe(concat(function (files) {
      callback(null, files.concat(new File({
        path: 'index.html',
        contents: new Buffer(pageTemplate({
          docs: comments,
          options: options
        }), 'utf8')
      })));
    }));
};
