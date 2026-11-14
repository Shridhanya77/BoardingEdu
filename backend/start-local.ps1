$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = $null
if ($env:VIRTUAL_ENV) {
    $activePython = Join-Path $env:VIRTUAL_ENV "Scripts\python.exe"
    if (Test-Path $activePython) {
        $python = $activePython
    }
}

if (-not $python) {
    foreach ($environment in @(".venv", "venv")) {
        $environmentPython = Join-Path $PSScriptRoot "$environment\Scripts\python.exe"
        if (Test-Path $environmentPython) {
            $python = $environmentPython
            break
        }
    }
}

if (-not $python) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw "Python was not found. Create the backend virtual environment or install Python."
    }
    $python = $pythonCommand.Source
}

$databasePath = Join-Path $PSScriptRoot "db.sqlite3"
$databaseUrlPath = $databasePath.Replace([char]92, [char]47)
$env:DATABASE_URL = "sqlite:///$databaseUrlPath"
$env:DEBUG = "True"
$env:ALLOWED_HOSTS = "localhost,127.0.0.1"

Write-Host "Using local SQLite database: $databasePath"
& $python manage.py check
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $python manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $python manage.py runserver 127.0.0.1:8000
exit $LASTEXITCODE
