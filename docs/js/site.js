function load() {
    ZeroClipboard.config({
        swfPath: window.location.origin + '/mapbox-gl-js/js/ZeroClipboard.swf',
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
                var type = (location.pathname.split('plugins').length > 1) ? 'plugin' : 'example';
                analytics.track('Copied ' + type + ' with clipboard');
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
}

$(load);
