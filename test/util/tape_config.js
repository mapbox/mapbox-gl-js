// This file sets up tape with the add-ons we need,
// this file also acts as the entrypoint for browserify.
var tape = require('tape')
// var through = require('through');

// // Add dom-prettyfied DOM output for browser
// // Internally this calls tape.createObjectStream, and uses that to generate DOM on the page.
// require('tape-dom')(tape);

// //Helper method that creates a stream to pipe TAP output to testem
// function testemStream() {
//     var line = '';
//     var stream = through(write, flush);
//     return stream;

//     function write(buf) {
//         for (var i = 0; i < buf.length; i++) {
//             var c = typeof buf === 'string'
//                 ? buf.charAt(i)
//                 : String.fromCharCode(buf[i])
//             ;
//             if (c === '\n') flush();
//             else line += c;
//         }
//     }

//     function flush() {
//         try { Testem.emit('tap', line); }
//         catch (e) { stream.emit('error', e); }
//         line = '';
//     }
// };
// tape.createStream().pipe(testemStream());

// // Add test filtering ability
function getQueryVariable(variable)
{
       var query = window.location.search.substring(1);
       var vars = query.split("&");
       for (var i=0;i<vars.length;i++) {
               var pair = vars[i].split("=");
               if(pair[0] == variable){return pair[1];}
       }
       return(false);
}
var filter = getQueryVariable('filter') || '.*';
var test = require('tape-filter')(tape, filter);


module.exports = tape;