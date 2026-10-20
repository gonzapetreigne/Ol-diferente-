@echo off
chcp 65001 > nul
title Olé Diferente - Actualizador de Precios y Stock
cd /d "%~dp0"

echo ================================================================
echo        OLÉ DIFERENTE - ACTUALIZADOR DE CATÁLOGO AUTOMÁTICO
echo ================================================================
echo.
echo [1/3] Conectando con Google Drive y sincronizando la web...
echo.

node actualizar_web_desde_excel.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ----------------------------------------------------------------
    echo [ERROR] Hubo un error durante la actualizacion.
    echo Verifique su conexion a internet o el archivo de Google Drive.
    echo ----------------------------------------------------------------
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
git add Catalogo_Perfumes_Ole_Diferente.xlsx tienda.html productos/*.html
git diff --staged --quiet
if errorlevel 1 (
    echo [2/3] Subiendo cambios a GitHub Pages (web en vivo)...
    echo.
    git commit -m "Actualizacion automatica de precios y stock desde Google Drive"
    git push origin main
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ----------------------------------------------------------------
        echo [AVISO] Los archivos locales y Supabase se actualizaron,
        echo pero hubo un inconveniente al conectar con GitHub.
        echo ----------------------------------------------------------------
        echo.
        pause
        exit /b %ERRORLEVEL%
    )
) else (
    echo [2/3] Todos los precios ya coinciden con la web en vivo.
)

echo.
echo ================================================================
echo  ¡ÉXITO! Catálogo sincronizado y listo.
echo  Sitio web: https://www.olediferente.com.ar/tienda.html
echo ================================================================
echo.
pause
