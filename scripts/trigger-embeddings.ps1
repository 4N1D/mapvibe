# Script để trigger Lambda Embedding cho các restaurants đã import
# Usage: .\scripts\trigger-embeddings.ps1 -RestaurantIds "id1,id2,id3" -QueueUrl "https://sqs..."
# Hoặc: .\scripts\trigger-embeddings.ps1 -AllRestaurants -QueueUrl "https://sqs..." -DbConnectionString "..."

param(
    [Parameter(Mandatory=$false)]
    [string]$RestaurantIds,
    
    [Parameter(Mandatory=$false)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$AllRestaurants,
    
    [Parameter(Mandatory=$true)]
    [string]$QueueUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$DbConnectionString,
    
    [Parameter(Mandatory=$false)]
    [string]$AwsRegion
)

# Import AWS SDK
if (-not (Get-Module -ListAvailable -Name AWS.Tools.SQS)) {
    Write-Host "Installing AWS.Tools.SQS module..." -ForegroundColor Yellow
    Install-Module -Name AWS.Tools.SQS -Force -Scope CurrentUser
}

Import-Module AWS.Tools.SQS

# Auto-detect region from Queue URL if not provided
if (-not $AwsRegion) {
    if ($QueueUrl -match 'sqs\.([^.]+)\.amazonaws\.com') {
        $AwsRegion = $matches[1]
        Write-Host "📍 Auto-detected region from Queue URL: $AwsRegion" -ForegroundColor Cyan
    } else {
        $AwsRegion = "us-east-1"  # Default fallback
        Write-Host "⚠️  Could not detect region from Queue URL, using default: $AwsRegion" -ForegroundColor Yellow
    }
}

Write-Host "🚀 Trigger Embedding Jobs Script" -ForegroundColor Cyan
Write-Host "Queue URL: $QueueUrl" -ForegroundColor Gray
Write-Host "AWS Region: $AwsRegion" -ForegroundColor Gray
Write-Host ""

$restaurantIdsList = @()

if ($AllRestaurants) {
    if (-not $DbConnectionString) {
        Write-Host "❌ Error: DbConnectionString is required when using -AllRestaurants" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "📋 Fetching all restaurant IDs from database..." -ForegroundColor Yellow
    
    # Note: User cần cài Npgsql hoặc dùng cách khác để query DB
    # Đây là ví dụ, user có thể thay bằng cách query DB của họ
    Write-Host "⚠️  Please query your database to get restaurant IDs:" -ForegroundColor Yellow
    Write-Host "   SELECT id FROM restaurants WHERE embedding IS NULL;" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then run this script with -RestaurantIds parameter" -ForegroundColor Yellow
    exit 0
} elseif ($InputFile) {
    if (-not (Test-Path $InputFile)) {
        Write-Host "❌ Error: Input file not found: $InputFile" -ForegroundColor Red
        exit 1
    }
    Write-Host "📄 Reading restaurant IDs from file: $InputFile" -ForegroundColor Yellow
    $restaurantIdsList = Get-Content $InputFile | Where-Object { $_.Trim() -ne '' } | ForEach-Object { $_.Trim() }
    Write-Host "   Found $($restaurantIdsList.Count) restaurant IDs" -ForegroundColor Gray
} elseif ($RestaurantIds) {
    $restaurantIdsList = $RestaurantIds -split ',' | ForEach-Object { $_.Trim() }
} else {
    Write-Host "❌ Error: Either -RestaurantIds, -InputFile, or -AllRestaurants must be provided" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage examples:" -ForegroundColor Yellow
    Write-Host "  .\scripts\trigger-embeddings.ps1 -RestaurantIds 'id1,id2,id3' -QueueUrl 'https://sqs...'" -ForegroundColor Gray
    Write-Host "  .\scripts\trigger-embeddings.ps1 -InputFile 'data_gen/restaurant_ids.txt' -QueueUrl 'https://sqs...'" -ForegroundColor Gray
    Write-Host "  .\scripts\trigger-embeddings.ps1 -AllRestaurants -QueueUrl 'https://sqs...' -DbConnectionString '...'" -ForegroundColor Gray
    exit 1
}

if ($restaurantIdsList.Count -eq 0) {
    Write-Host "❌ Error: No restaurant IDs provided" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Sending $($restaurantIdsList.Count) messages to SQS queue..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($restaurantId in $restaurantIdsList) {
    try {
        # Keep restaurant_id as string (supports both string IDs like "R_xxx" and numeric IDs)
        $messageBody = @{
            restaurant_id = $restaurantId
        } | ConvertTo-Json -Compress
        
        $response = Send-SQSMessage -QueueUrl $QueueUrl -MessageBody $messageBody -Region $AwsRegion
        
        Write-Host "✅ Sent: $restaurantId (MessageId: $($response.MessageId))" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "❌ Failed: $restaurantId - $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Success: $successCount" -ForegroundColor Green
Write-Host "   ❌ Failed: $failCount" -ForegroundColor Red
Write-Host ""
Write-Host "💡 Lambda Embedding will process these jobs automatically from SQS queue" -ForegroundColor Yellow

