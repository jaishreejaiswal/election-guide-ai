# PowerShell Zero-Dependency Local Static HTTP Server for Election Guide AI
# Works out of the box on Windows without Node.js or Python!

$port = 8080
$url = "http://localhost:$port/"
$prefix = "http://localhost:$port/"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       🗳️  Election Guide AI - Local Server              " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$folder = $PSScriptRoot
if (-not $folder) { $folder = (Get-Location).Path }

Write-Host "Serving files from: $folder" -ForegroundColor Green
Write-Host "Opening in browser: $url" -ForegroundColor Cyan

# Open default browser
Start-Process $url

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Port $port busy, trying port 8081..." -ForegroundColor Yellow
    $port = 8081
    $url = "http://localhost:$port/"
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
    Start-Process $url
}

Write-Host "Server running at $url. Press Ctrl+C to stop." -ForegroundColor White

$mimeMap = @{
    ".html" = "text/html; charset=utf-8";
    ".css"  = "text/css; charset=utf-8";
    ".js"   = "application/javascript; charset=utf-8";
    ".json" = "application/json; charset=utf-8";
    ".svg"  = "image/svg+xml";
    ".png"  = "image/png";
    ".jpg"  = "image/jpeg";
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($path) -or $path -eq "/") {
            $path = "index.html"
        }

        $filePath = Join-Path $folder $path

        if (Test-Path -Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "application/octet-stream"
            if ($mimeMap.ContainsKey($ext)) {
                $mime = $mimeMap[$ext]
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.AddHeader("Cache-Control", "no-cache")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "`nServer stopped." -ForegroundColor Yellow
}
