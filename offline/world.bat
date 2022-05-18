call D:\QGIS\bin\o4w_env.bat
rd /s /q world
call gdal2tiles.bat -w none -r average -a 0.0 -n world.tif world
