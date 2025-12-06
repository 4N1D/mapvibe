# Build Lambda RAG package với Docker (để đảm bảo dependencies Linux-compatible)
# Đây là script riêng cho lambda-rag vì nó là lambda duy nhất cần build (có FastAPI + Pydantic)

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$LAMBDA_DIR = "$ROOT_DIR\infrastructure\terraform\modules\lambda-rag"
$SRC_DIR = "$LAMBDA_DIR\src"
$BUILD_DIR = "$LAMBDA_DIR\build"
$ZIP_FILE = "$LAMBDA_DIR\lambda-rag.zip"

# Check Docker
$DOCKER = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $DOCKER) {
    Write-Host "[ERROR] Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    exit 1
}

Write-Host "`n==> Building Lambda RAG package với Docker..." -ForegroundColor Cyan
Write-Host "   (Lambda này cần build vì có FastAPI + Pydantic với native extensions)" -ForegroundColor Gray

# Clean build directory
if (Test-Path $BUILD_DIR) {
    Write-Host "`n[1/5] Cleaning build directory..." -ForegroundColor Yellow
    Remove-Item -Path $BUILD_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $BUILD_DIR -Force | Out-Null

# Copy source files (không copy dependencies)
Write-Host "`n[2/5] Copying source files..." -ForegroundColor Yellow
Copy-Item -Path "$SRC_DIR\main.py" -Destination "$BUILD_DIR\main.py" -Force
Copy-Item -Path "$SRC_DIR\requirements.txt" -Destination "$BUILD_DIR\requirements.txt" -Force

# Build với Docker (sử dụng Python 3.12 image giống Lambda runtime)
Write-Host "`n[3/5] Installing dependencies với Docker (Linux-compatible)..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray

# Tạo Dockerfile tạm thời
$DOCKERFILE = @"
FROM public.ecr.aws/lambda/python:3.12

WORKDIR /var/task

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --target . -r requirements.txt

# Copy source code
COPY main.py .

CMD ["main.handler"]
"@

$DOCKERFILE_PATH = "$BUILD_DIR\Dockerfile"
$DOCKERFILE | Out-File -FilePath $DOCKERFILE_PATH -Encoding utf8 -NoNewline

# Build Docker image
Push-Location $BUILD_DIR
docker build -t lambda-rag-builder:latest . 2>&1 | ForEach-Object {
    if ($_ -match "ERROR|error|Error") {
        Write-Host $_ -ForegroundColor Red
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Docker build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Extract dependencies từ Docker container
Write-Host "`n[4/5] Extracting dependencies từ Docker container..." -ForegroundColor Yellow

# Tạo container tạm thời
$CONTAINER_ID = docker create lambda-rag-builder:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create container" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Copy files từ container
docker cp "${CONTAINER_ID}:/var/task" "$BUILD_DIR\package" 2>&1 | Out-Null

# Remove container
docker rm $CONTAINER_ID | Out-Null

# Move files từ package/ về build/
Write-Host "`n[5/5] Packaging Lambda zip..." -ForegroundColor Yellow
Get-ChildItem -Path "$BUILD_DIR\package" -Exclude "__pycache__" | ForEach-Object {
    if ($_.PSIsContainer) {
        Copy-Item -Path $_.FullName -Destination "$BUILD_DIR\$($_.Name)" -Recurse -Force
    } else {
        Copy-Item -Path $_.FullName -Destination "$BUILD_DIR\$($_.Name)" -Force
    }
}

# Clean up
Remove-Item -Path "$BUILD_DIR\package" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$BUILD_DIR\Dockerfile" -Force -ErrorAction SilentlyContinue

# Create zip file
if (Test-Path $ZIP_FILE) {
    Remove-Item -Path $ZIP_FILE -Force
}

# Zip tất cả files trong build directory
Write-Host "   Creating zip file..." -ForegroundColor Gray
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Tạo zip với files ở root level
$zip = $null
try {
    $zip = [System.IO.Compression.ZipFile]::Open($ZIP_FILE, [System.IO.Compression.ZipArchiveMode]::Create)
    
    Get-ChildItem -Path $BUILD_DIR -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($BUILD_DIR.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relativePath) | Out-Null
    }
} finally {
    if ($zip) {
        $zip.Dispose()
        $zip = $null
        # Đợi một chút để đảm bảo file handles được đóng
        Start-Sleep -Milliseconds 100
    }
}

# Clean up build directory (với retry logic)
Write-Host "   Cleaning up build directory..." -ForegroundColor Gray
$maxRetries = 3
$retryCount = 0
$removed = $false

while (-not $removed -and $retryCount -lt $maxRetries) {
    try {
        Remove-Item -Path $BUILD_DIR -Recurse -Force -ErrorAction Stop
        $removed = $true
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "   Retry $retryCount/$maxRetries..." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 200
        } else {
            Write-Host "   ⚠️  Warning: Could not remove build directory. You may need to delete it manually." -ForegroundColor Yellow
            Write-Host "   Path: $BUILD_DIR" -ForegroundColor Gray
        }
    }
}

# Verify zip
$ZIP_SIZE = (Get-Item $ZIP_FILE).Length / 1MB
Write-Host "`n✅ Lambda package built successfully!" -ForegroundColor Green
Write-Host "   File: $ZIP_FILE" -ForegroundColor Cyan
Write-Host "   Size: $([math]::Round($ZIP_SIZE, 2)) MB" -ForegroundColor Cyan

# Check if size is reasonable (Lambda limit is 50MB unzipped, 250MB unzipped for container)
if ($ZIP_SIZE -gt 50) {
    Write-Host "`n⚠️  Warning: Package size is large. Consider using Lambda Layers for dependencies." -ForegroundColor Yellow
}

Write-Host "`n==> Ready to deploy với Terraform!" -ForegroundColor Green

Pop-Location
