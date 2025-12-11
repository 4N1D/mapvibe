# Build Lambda Review Aggregate package với Docker (để đảm bảo dependencies Linux-compatible)

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$LAMBDA_DIR = "$ROOT_DIR\infrastructure\terraform\modules\lambda-review-aggregate"
$SRC_DIR = "$LAMBDA_DIR\src"
$BUILD_DIR = "$LAMBDA_DIR\build"
$ZIP_FILE = "$LAMBDA_DIR\lambda-review-aggregate.zip"

# Check Docker
$DOCKER = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $DOCKER) {
    Write-Host "[ERROR] Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    exit 1
}

Write-Host "`n==> Building Lambda Review Aggregate package với Docker..." -ForegroundColor Cyan

# Clean build directory
if (Test-Path $BUILD_DIR) {
    Write-Host "`n[1/5] Cleaning build directory..." -ForegroundColor Yellow
    Remove-Item -Path $BUILD_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $BUILD_DIR -Force | Out-Null

# Copy source files
Write-Host "`n[2/5] Copying source files..." -ForegroundColor Yellow
Get-ChildItem -Path $SRC_DIR -File | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination "$BUILD_DIR\$($_.Name)" -Force
}

# Build với Docker
Write-Host "`n[3/5] Installing dependencies với Docker (Linux-compatible)..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray

# Try to pull base image first (with retry)
Write-Host "   Pulling base image..." -ForegroundColor Gray
$maxRetries = 3
$retryCount = 0
$imagePulled = $false

while (-not $imagePulled -and $retryCount -lt $maxRetries) {
    $pullOutput = & docker pull public.ecr.aws/lambda/python:3.12 2>&1
    if ($LASTEXITCODE -eq 0) {
        $imagePulled = $true
        Write-Host "   ✅ Base image pulled successfully" -ForegroundColor Green
    } else {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "   ⚠️  Retry $retryCount/$maxRetries..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        } else {
            Write-Host "   ❌ Failed to pull base image after $maxRetries attempts" -ForegroundColor Red
            Write-Host "`n💡 Troubleshooting:" -ForegroundColor Yellow
            Write-Host "   1. Check your internet connection" -ForegroundColor Gray
            Write-Host "   2. Check if Docker can access AWS ECR (public.ecr.aws)" -ForegroundColor Gray
            Write-Host "   3. If behind a proxy, configure Docker proxy settings:" -ForegroundColor Gray
            Write-Host "      - Docker Desktop > Settings > Resources > Proxies" -ForegroundColor Gray
            Write-Host "   4. Try: docker pull public.ecr.aws/lambda/python:3.12 manually" -ForegroundColor Gray
            Write-Host "`n   Will try to build anyway (Docker will pull during build)..." -ForegroundColor Yellow
        }
    }
}

# Tạo Dockerfile tạm thời
$DOCKERFILE = @"
FROM public.ecr.aws/lambda/python:3.12

WORKDIR /var/task

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --target . -r requirements.txt

# Copy source code
COPY *.py .

CMD ["main.lambda_handler"]
"@

$DOCKERFILE_PATH = "$BUILD_DIR\Dockerfile"
$DOCKERFILE | Out-File -FilePath $DOCKERFILE_PATH -Encoding utf8 -NoNewline

# Build Docker image
Push-Location $BUILD_DIR
$ErrorActionPreference = "Continue"
Write-Host "   Building Docker image..." -ForegroundColor Gray
$buildOutput = & docker build --progress=plain -t lambda-review-aggregate-builder:latest . 2>&1
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
    
    # Check if it's a network/ECR connection issue
    $isNetworkError = ($buildOutput -match "failed to resolve|dial tcp|connectex|no HTTPS proxy|ECONNREFUSED").Count -gt 0
    if ($isNetworkError) {
        Write-Host "`n🔍 Network/Connection Issue Detected" -ForegroundColor Yellow
        Write-Host "`n💡 Solutions:" -ForegroundColor Cyan
        Write-Host "   1. Check internet connection and firewall settings" -ForegroundColor Gray
        Write-Host "   2. Configure Docker proxy (if behind corporate proxy):" -ForegroundColor Gray
        Write-Host "      - Docker Desktop > Settings > Resources > Proxies" -ForegroundColor Gray
        Write-Host "      - Or create/edit: C:\Users\$env:USERNAME\.docker\config.json" -ForegroundColor Gray
        Write-Host "   3. Test connection manually:" -ForegroundColor Gray
        Write-Host "      docker pull public.ecr.aws/lambda/python:3.12" -ForegroundColor White
        Write-Host "   4. If using VPN, try disconnecting/reconnecting" -ForegroundColor Gray
        Write-Host "   5. Check if your network blocks AWS ECR (public.ecr.aws)" -ForegroundColor Gray
    }
    
    Pop-Location
    exit 1
}

# Extract dependencies từ Docker container
Write-Host "`n[4/5] Extracting dependencies từ Docker container..." -ForegroundColor Yellow

$CONTAINER_ID = docker create lambda-review-aggregate-builder:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create container" -ForegroundColor Red
    Pop-Location
    exit 1
}

docker cp "${CONTAINER_ID}:/var/task" "$BUILD_DIR\package" 2>&1 | Out-Null
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

Write-Host "   Creating zip file..." -ForegroundColor Gray
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
        if ($zip) {
            $zip.Dispose()
            Start-Sleep -Milliseconds 100
        }
    }
} catch {
    # Fallback to Compress-Archive
    Write-Host "   Using Compress-Archive fallback..." -ForegroundColor Yellow
    Push-Location $BUILD_DIR
    Compress-Archive -Path * -DestinationPath $ZIP_FILE -Force
    Pop-Location
}

# Clean up build directory
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

if ($ZIP_SIZE -gt 50) {
    Write-Host "`n⚠️  Warning: Package size is large. Consider using Lambda Layers for dependencies." -ForegroundColor Yellow
}

Write-Host "`n==> Ready to deploy với Terraform!" -ForegroundColor Green

Pop-Location


