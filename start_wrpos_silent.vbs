' WR POS — Silent Startup Launcher
' This VBS script launches the POS app with NO visible console window.
' Place a shortcut to this file in the Windows Startup folder:
'   Win + R → shell:startup → paste shortcut here

Set oShell = CreateObject("WScript.Shell")
oShell.CurrentDirectory = "C:\Users\smile\Downloads\wr-pos"

' Launch Electron silently (window hidden = 0)
oShell.Run """.\node_modules\electron\dist\electron.exe"" . --no-sandbox", 0, False

Set oShell = Nothing
