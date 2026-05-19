@echo off
REM Build script for creating Windows distributable package
REM Run this after running setup.bat

echo.
echo ========================================
echo      Z Desktop Agent - Build
echo ========================================
echo.

REM Build renderer first
echo Building renderer (React)...
call npx webpack --config webpack.renderer.js --mode production

echo.
echo Renderer built successfully!
echo.

if "%1"=="win" goto :win
if "%1"=="linux" goto :linux
if "%1"=="all" goto :all

echo Specify target: build.bat win | build.bat linux | build.bat all
echo Current platform: Windows
echo Recommended: build.bat win
goto :end

:win
echo Building Windows package (.exe)...
call npx electron-builder --win
echo Windows package built in dist/
goto :end

:linux
echo Building Linux packages (.deb + AppImage)...
call npx electron-builder --linux
echo Linux packages built in dist/
goto :end

:all
echo Building all platforms...
call npx electron-builder --linux --win
echo All packages built in dist/
goto :end

:end
echo.
echo Build complete! Check the dist/ directory for installers.
pause
