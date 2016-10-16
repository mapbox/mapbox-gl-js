(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
mapboxgl.accessToken = getAccessToken();

function getAccessToken() {
    var accessToken = (
        "pk.eyJ1IjoibHVjYXN3b2oiLCJhIjoiNWtUX3JhdyJ9.WtCTtw6n20XV2DwwJHkGqQ" ||
        "pk.eyJ1IjoibHVjYXN3b2oiLCJhIjoiNWtUX3JhdyJ9.WtCTtw6n20XV2DwwJHkGqQ" ||
        getURLParameter('access_token') ||
        localStorage.getItem('accessToken')
    );
    localStorage.setItem('accessToken', accessToken);
    return accessToken;
}

function getURLParameter(name) {
    var regexp = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
    var output = regexp.exec(window.location.href);
    return output && output[1];
}

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZWJ1Zy9hY2Nlc3MtdG9rZW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtYXBib3hnbC5hY2Nlc3NUb2tlbiA9IGdldEFjY2Vzc1Rva2VuKCk7XG5cbmZ1bmN0aW9uIGdldEFjY2Vzc1Rva2VuKCkge1xuICAgIHZhciBhY2Nlc3NUb2tlbiA9IChcbiAgICAgICAgXCJway5leUoxSWpvaWJIVmpZWE4zYjJvaUxDSmhJam9pTld0VVgzSmhkeUo5Lld0Q1R0dzZuMjBYVjJEd3dKSGtHcVFcIiB8fFxuICAgICAgICBcInBrLmV5SjFJam9pYkhWallYTjNiMm9pTENKaElqb2lOV3RVWDNKaGR5SjkuV3RDVHR3Nm4yMFhWMkR3d0pIa0dxUVwiIHx8XG4gICAgICAgIGdldFVSTFBhcmFtZXRlcignYWNjZXNzX3Rva2VuJykgfHxcbiAgICAgICAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FjY2Vzc1Rva2VuJylcbiAgICApO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdhY2Nlc3NUb2tlbicsIGFjY2Vzc1Rva2VuKTtcbiAgICByZXR1cm4gYWNjZXNzVG9rZW47XG59XG5cbmZ1bmN0aW9uIGdldFVSTFBhcmFtZXRlcihuYW1lKSB7XG4gICAgdmFyIHJlZ2V4cCA9IG5ldyBSZWdFeHAoJ1s/Jl0nICsgbmFtZSArICc9KFteJiNdKiknLCAnaScpO1xuICAgIHZhciBvdXRwdXQgPSByZWdleHAuZXhlYyh3aW5kb3cubG9jYXRpb24uaHJlZik7XG4gICAgcmV0dXJuIG91dHB1dCAmJiBvdXRwdXRbMV07XG59XG4iXX0=
