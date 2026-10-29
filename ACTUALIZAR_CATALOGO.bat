@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title Ole Diferente - Actualizador de Precios y Stock
pushd "%~dp0"

echo ================================================================
echo        OLE DIFERENTE - ACTUALIZADOR DE CATALOGO AUTOMATICO
echo ================================================================
echo.
echo [1/3] Conectando con Google Drive y sincronizando la web...
echo.

node "%~dp0actualizar_web_desde_excel.js"

if errorlevel 1 (
    echo.
    echo ----------------------------------------------------------------
    echo [ERROR] Hubo un error durante la actualizacion.
    echo Verifique su conexion a internet o el archivo de Google Drive.
    echo ----------------------------------------------------------------
    echo.
    popd
    pause
    exit /b 1
)

echo.
git add Catalogo_Perfumes_Ole_Diferente.xlsx tienda.html productos/*.html img/fragancias/*
git diff --staged --quiet
if errorlevel 1 (
    echo [2/3] Subiendo cambios a GitHub Pages - web en vivo...
    echo.
    git commit -m "Actualizacion automatica de precios y stock desde Google Drive"
    git push origin main
    if errorlevel 1 (
        echo.
        echo ----------------------------------------------------------------
        echo [AVISO] Los archivos locales y Supabase se actualizaron,
        echo pero hubo un inconveniente al conectar con GitHub.
        echo ----------------------------------------------------------------
        echo.
        popd
        pause
        exit /b 1
    )
) else (
    echo [2/3] Todos los precios ya coinciden con la web en vivo.
)

echo.
echo ================================================================
echo  EXITO: Catalogo sincronizado y publicado en vivo.
echo  Sitio web: https://www.olediferente.com.ar/tienda.html
echo ================================================================
echo.
popd
pause
