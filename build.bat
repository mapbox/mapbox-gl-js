call D:\Green\VS2015\VC\bin\x86_amd64\vcvarsx86_amd64.bat
set path=%path%;D:\Green\msys\usr\bin;D:\Green\git\usr\bin;D:\Green\git\bin
set path=%path%;D:\Green\nasm
set path=%path%;D:\Green\msys\mingw64\bin
set MSYSTEM=MINGW64
set MSYS2_PATH_TYPE=inherit

rem call npm install -g cnpm --registry=https://registry.npm.taobao.org
rem call npm config set registry http://registry.npm.taobao.org
rem call cnpm -v
set path=D:\QGIS\apps\Python39;%path%
call cnpm install
sed -i 's#this._authenticate#//this._authenticate#g' src/ui/map.js
call npm run build-dev
call npm run build-css

pause