// This file sets up tape with the add-ons we need,
// this file also acts as the entrypoint for browserify.
var tape = require('tape');

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


module.exports = test;