$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
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
