# Test Gemini 2.0 API with PowerShell
$apiKey = "AIzaSyDblUaTrcN8W6ronMWHWSB4nY3_V_9cRBg"
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

$headers = @{
    "Content-Type" = "application/json"
    "X-goog-api-key" = $apiKey
}

$body = @{
    contents = @(
        @{
            parts = @(
                @{
                    text = "Explain how AI works in a few words"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "🚀 Testing Gemini 2.0 Flash API..."
Write-Host "🔑 API Key: $($apiKey.Substring(0, 20))..."

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -ContentType "application/json"
    
    Write-Host "✅ SUCCESS! API call successful!"
    Write-Host "📝 Response: $($response.candidates[0].content.parts[0].text)"
    
    # Test if we can extract the response properly
    if ($response.candidates -and $response.candidates[0].content -and $response.candidates[0].content.parts) {
        $text = $response.candidates[0].content.parts[0].text
        Write-Host "🎯 Extracted Text: $text"
        return @{ success = $true; model = "gemini-2.0-flash"; response = $text }
    } else {
        Write-Host "⚠️ Unexpected response format"
        return @{ success = $false; error = "Unexpected response format" }
    }
    
} catch {
    Write-Host "❌ API call failed: $($_.Exception.Message)"
    Write-Host "🔍 Status Code: $($_.Exception.Response.StatusCode)"
    return @{ success = $false; error = $_.Exception.Message }
}

Write-Host "`n=== FINAL RESULT ==="
