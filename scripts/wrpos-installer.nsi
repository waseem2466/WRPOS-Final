Unicode true
Name "WR POS"
OutFile "C:\Users\wasee\OneDrive\Desktop\wr-pos\release\WR POS Setup 4.3.9.exe"
InstallDir "$LOCALAPPDATA\Programs\WR POS"
RequestExecutionLevel user
SetCompressor zlib
Icon "C:\Users\wasee\OneDrive\Desktop\wr-pos\build\icons\icon.ico"
UninstallIcon "C:\Users\wasee\OneDrive\Desktop\wr-pos\build\icons\icon.ico"

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "C:\Users\wasee\OneDrive\Desktop\wr-pos\build\icons\icon.ico"
!define MUI_UNICON "C:\Users\wasee\OneDrive\Desktop\wr-pos\build\icons\icon.ico"
!define APP_EXE "WR POS.exe"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install WR POS" SEC01
  SetOutPath "$INSTDIR"
  File /r "C:\Users\wasee\OneDrive\Desktop\wr-pos\release\win-unpacked\*.*"

  CreateDirectory "$SMPROGRAMS\WR POS"
  CreateShortCut "$DESKTOP\WR POS.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\WR POS\WR POS.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\WR POS\Uninstall WR POS.lnk" "$INSTDIR\Uninstall WR POS.exe"

  WriteUninstaller "$INSTDIR\Uninstall WR POS.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WR POS" "DisplayName" "WR POS"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WR POS" "DisplayVersion" "4.3.9"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WR POS" "Publisher" "WR POS Enterprise"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WR POS" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WR POS" "UninstallString" "$\"$INSTDIR\Uninstall WR POS.exe$\""
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\WR POS.lnk"
  Delete "$SMPROGRAMS\WR POS\WR POS.lnk"
  Delete "$SMPROGRAMS\WR POS\Uninstall WR POS.lnk"
  RMDir "$SMPROGRAMS\WR POS"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WR POS"
SectionEnd
