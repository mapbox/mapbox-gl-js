/* global anchors */

// add anchor links to headers
anchors.options.placement = 'left';
anchors.add('h3');

function toggleSibling() {
  var stepSibling = this.parentNode.getElementsByClassName('toggle-target')[0];
  toggleHidden(stepSibling.classList);

  var icon = this.parentNode.getElementsByClassName('icon')[0];
  toggleCaret(icon.classList);
}

var items = document.getElementsByClassName('toggle-sibling');
for (var j = 0; j < items.length; j++) {
  items[j].addEventListener('click', toggleSibling);
}

var toclinks = document.getElementsByClassName('pre-open');
for (var k = 0; k < toclinks.length; k++) {
  toclinks[k].addEventListener('mousedown', preOpen, false);
}

function toggleCaret(classList) {
  if (classList.contains('caret-right')) {
    classList.remove('caret-right');
    classList.add('caret-down');
  } else {
    classList.add('caret-right');
    classList.remove('caret-down');
  }
}

function toggleHidden(classList) {
  if (classList.contains('hidden')) {
    classList.remove('hidden');
  } else {
    classList.add('hidden');
  }
}

function preOpen() {
  toggleCaret(this.classList);
}

function showHashTarget(targetId) {
  var hashTarget = document.getElementById(targetId);
  var toggleInside = hashTarget.querySelector('.hidden.toggle-target');
  var toggleSibling = hashTarget.querySelector('.toggle-sibling');
  if (toggleInside && toggleSibling) {
    toggleSibling.click();
  }
}

window.addEventListener('hashchange', function() {
  showHashTarget(location.hash.substring(1));
});

showHashTarget(location.hash.substring(1));
