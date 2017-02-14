/* global anchors */

// add anchor links to headers
anchors.options.placement = 'left';
anchors.add('h3');

function toggleSibling() {
  var stepSibling = this.parentNode.getElementsByClassName('toggle-target')[0];
  toggleHidden(stepSibling.classList);

  var icon = this.parentNode.getElementsByClassName('rcon')[0];
  toggleCaret(icon.classList);
}

var items = document.getElementsByClassName('toggle-sibling');
for (var j = 0; j < items.length; j++) {
  items[j].addEventListener('click', toggleSibling);
}

function toggleCaret(classList) {
  if (classList.contains('caret-right')) {
    classList.remove('caret-right');
    classList.add('caret-down', 'strong');
  } else {
    classList.add('caret-right');
    classList.remove('caret-down', 'strong');
  }
}

function toggleHidden(classList) {
  if (classList.contains('hidden')) {
    classList.remove('hidden');
  } else {
    classList.add('hidden');
  }
}

function showHashTarget(hash) {
  var targetId = hash && hash.substring(1);
  if (!targetId) return;
  var hashTarget = document.getElementById(targetId);
  if (!hashTarget) return;
  var toggleInside = hashTarget.querySelector('.hidden.toggle-target');
  var toggleSibling = hashTarget.querySelector('.toggle-sibling');
  if (toggleInside && toggleSibling) {
    toggleSibling.click();
  }
}

window.addEventListener('hashchange', function() {
  showHashTarget(location.hash);
});

showHashTarget(location.hash);

var quickstartCDN = document.getElementById('quickstart-cdn');
var quickstartBundler = document.getElementById('quickstart-bundler');
var toggles = document.getElementsByClassName('method-toggle');
for (var i = 0; i < toggles.length; i++) {
  toggles[i].onclick = exampleToggle;
}
function exampleToggle(e) {
  for (var i = 0; i < toggles.length; i++) {
    toggles[i].className = this === toggles[i] ? 'method-toggle active' : 'method-toggle';
  }
  if (this.getAttribute('data-target') === 'quickstart-cdn') {
    quickstartCDN.className = '';
    quickstartBundler.className = 'hidden';
  } else {
    quickstartCDN.className = 'hidden';
    quickstartBundler.className = '';
  }
  e.preventDefault();
}
