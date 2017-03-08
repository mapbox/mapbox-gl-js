function load() {
    ZeroClipboard.config({
        swfPath: window.location.origin + '/mapbox-gl-js/src/ZeroClipboard.swf',
        forceHandCursor: true
    });

    $('.js-clipboard').each(function() {
        var $clip = $(this);
        if (!$clip.data('zeroclipboard-bound')) {
            $clip.data('zeroclipboard-bound', true);
            var clip = new ZeroClipboard(this);
            clip.on('aftercopy', function() {
                $clip.siblings('input').select();
                var text = $clip.text();
                $clip.text('Copied to clipboard! ');
                setTimeout(function() {
                    $clip.text(text);
                }, 1000);
                analytics.track('Copied example with clipboard');
            });
        }
    });

    $('.js-clipboard').on('click', function() {
        return false;
    });

    $('.js-signup').on('click',function() {
        $('a.action.signup').trigger('click');
        return false;
    });

    $('[data-href]').on('click', function() {
        window.location = $(this).data('href');
    });
}

$(load);

// Search bar for examples page
var filterInput = document.getElementById('filter-input');
var headings = document.getElementsByClassName('heading');
var tocElements = document.getElementsByClassName('example-names');

if (filterInput) {
    filterInput.addEventListener('keyup', function (e) {
        var value = this.value.toLowerCase();
        var element;
        for (i=0; i < headings.length; i++) {
            if (!value || value == undefined || value == "" || value.length == 0) {
                headings[i].style.display = 'block';
            } else {
                headings[i].style.display = 'none';
            }
        }
        for (i=0; i < tocElements.length; i++) {
            element = tocElements[i];
        }
        var match = function () {
            return true;
        };
        var value = this.value.toLowerCase();
        if (!value.match(/^\s*$/)) {
            match = function (element) {
                return element.innerHTML.toLowerCase().indexOf(value) !== -1;
            };
        }
        for (i = 0; i < tocElements.length; i++) {
            element = tocElements[i];
            children = Array.from(element.getElementsByTagName('li'));
            if (match(element) || children.some(match)) {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        }
    });
}
