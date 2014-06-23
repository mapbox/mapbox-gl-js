<html>
<body>
<script>
var canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d');

canvas.width = 1;
canvas.height = 1;

ctx.fillStyle = value;
ctx.fillRect(0, 0, 1, 1);
var c = ctx.getImageData(0, 0, 1, 1).data;
</script>
