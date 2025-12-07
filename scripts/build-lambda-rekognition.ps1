# Build Lambda Rekognition package với Docker

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$LAMBDA_DIR = "$ROOT_DIR\infrastructure\terraform\modules\lambda-rekognition"
$SRC_DIR = "$LAMBDA_DIR\src"
$BUILD_DIR = "$LAMBDA_DIR\build"
$ZIP_FILE = "$LAMBDA_DIR\lambda-rekognition.zip"

$DOCKER = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $DOCKER) {
    Write-Host "[ERROR] Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    exit 1
}

Write-Host "`n==> Building Lambda Rekognition package với Docker..." -ForegroundColor Cyan

if (Test-Path $BUILD_DIR) {
    Write-Host "`n[1/5] Cleaning build directory..." -ForegroundColor Yellow
    Remove-Item -Path $BUILD_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $BUILD_DIR -Force | Out-Null

Write-Host "`n[2/5] Copying source files..." -ForegroundColor Yellow
Get-ChildItem -Path $SRC_DIR -File | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination "$BUILD_DIR\$($_.Name)" -Force
}

Write-Host "`n[3/5] Installing dependencies với Docker..." -ForegroundColor Yellow

$DOCKERFILE = @"
FROM public.ecr.aws/lambda/python:3.12
WORKDIR /var/task
COPY requirements.txt .
RUN pip install --target . -r requirements.txt
COPY *.py .
CMD ["main.lambda_handler"]
"@

$DOCKERFILE | Out-File -FilePath "$BUILD_DIR\Dockerfile" -Encoding utf8 -NoNewline

Push-Location $BUILD_DIR
$ErrorActionPreference = "Continue"
$buildOutput = & docker build --progress=plain -t lambda-rekognition-builder:latest . 2>&1
$buildSuccess = $LASTEXITCODE -eq 0
$ErrorActionPreference = "Stop"

# Show all output (filter out PowerShell exception messages)
$buildOutput | ForEach-Object {
    if ($_ -match "System\.Management\.Automation\.RemoteException") {
        # Skip PowerShell exception messages from Docker output
        return
    }
    if ($_ -match "ERROR|error|Error|failed|Failed|FAILED") {
        Write-Host $_ -ForegroundColor Red
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}

if (-not $buildSuccess) {
    Write-Host "`n❌ Docker build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "`n[4/5] Extracting dependencies..." -ForegroundColor Yellow
$CONTAINER_ID = docker create lambda-rekognition-builder:latest
docker cp "${CONTAINER_ID}:/var/task" "$BUILD_DIR\package" 2>&1 | Out-Null
docker rm $CONTAINER_ID | Out-Null

Write-Host "`n[5/5] Packaging Lambda zip..." -ForegroundColor Yellow
Get-ChildItem -Path "$BUILD_DIR\package" -Exclude "__pycache__" | ForEach-Object {
    if ($_.PSIsContainer) {
        Copy-Item -Path $_.FullName -Destination "$BUILD_DIR\$($_.Name)" -Recurse -Force
    } else {
        Copy-Item -Path $_.FullName -Destination "$BUILD_DIR\$($_.Name)" -Force
    }
}

Remove-Item -Path "$BUILD_DIR\package" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$BUILD_DIR\Dockerfile" -Force -ErrorAction SilentlyContinue

if (Test-Path $ZIP_FILE) {
    Remove-Item -Path $ZIP_FILE -Force
}

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
    $zip = $null
    try {
        $createMode = [System.IO.Compression.ZipArchiveMode]::Create
        $zip = [System.IO.Compression.ZipFile]::Open($ZIP_FILE, $createMode)
        Get-ChildItem -Path $BUILD_DIR -Recurse -File | ForEach-Object {
            $relativePath = $_.FullName.Substring($BUILD_DIR.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relativePath) | Out-Null
        }
    } finally {
        if ($zip) { $zip.Dispose(); Start-Sleep -Milliseconds 100 }
    }
} catch {
    # Fallback to Compress-Archive
    Write-Host "   Using Compress-Archive fallback..." -ForegroundColor Yellow
    Push-Location $BUILD_DIR
    Compress-Archive -Path * -DestinationPath $ZIP_FILE -Force
    Pop-Location
}

$maxRetries = 3
$retryCount = 0
while ($retryCount -lt $maxRetries) {
    try {
        Remove-Item -Path $BUILD_DIR -Recurse -Force -ErrorAction Stop
        break
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Start-Sleep -Milliseconds 200
        } else {
            Write-Host "   ⚠️  Warning: Could not remove build directory." -ForegroundColor Yellow
        }
    }
}

$ZIP_SIZE = (Get-Item $ZIP_FILE).Length / 1MB
Write-Host "`n✅ Lambda package built successfully!" -ForegroundColor Green
Write-Host "   File: $ZIP_FILE" -ForegroundColor Cyan
Write-Host "   Size: $([math]::Round($ZIP_SIZE, 2)) MB" -ForegroundColor Cyan

Pop-Location


