# Microsoft Developer Studio Project File - Name="GAMEVISION" - Package Owner=<4>
# Microsoft Developer Studio Generated Build File, Format Version 5.00
# ** DO NOT EDIT **

# TARGTYPE "Win32 (x86) Application" 0x0101

CFG=GAMEVISION - Win32 Release
!MESSAGE This is not a valid makefile. To build this project using NMAKE,
!MESSAGE use the Export Makefile command and run
!MESSAGE 
!MESSAGE NMAKE /f "GAMEVISION.MAK".
!MESSAGE 
!MESSAGE You can specify a configuration when running NMAKE
!MESSAGE by defining the macro CFG on the command line. For example:
!MESSAGE 
!MESSAGE NMAKE /f "GAMEVISION.MAK" CFG="GAMEVISION - Win32 Release"
!MESSAGE 
!MESSAGE Possible choices for configuration are:
!MESSAGE 
!MESSAGE "GAMEVISION - Win32 Release" (based on "Win32 (x86) Application")
!MESSAGE 

# Begin Project
# PROP Scc_ProjName ""
# PROP Scc_LocalPath ""
CPP=cl.exe
MTL=midl.exe
RSC=rc.exe
# PROP BASE Use_MFC 0
# PROP BASE Use_Debug_Libraries 0
# PROP BASE Output_Dir "GAMEVISI"
# PROP BASE Intermediate_Dir "GAMEVISI"
# PROP BASE Target_Dir ""
# PROP Use_MFC 0
# PROP Use_Debug_Libraries 0
# PROP Output_Dir "GAMEVISI"
# PROP Intermediate_Dir "GAMEVISI"
# PROP Ignore_Export_Lib 0
# PROP Target_Dir ""
# ADD BASE CPP /nologo /W3 /GX /O2 /D "WIN32" /D "NDEBUG" /D "_WINDOWS" /YX /FD /c
# ADD CPP /nologo /G5 /Zp16 /W3 /Gi /GX /O2 /D "WIN32" /D "NDEBUG" /D "_WINDOWS" /YX /FD /c
# SUBTRACT CPP /Fr
# ADD BASE MTL /nologo /D "NDEBUG" /mktyplib203 /o NUL /win32
# ADD MTL /nologo /D "NDEBUG" /mktyplib203 /o NUL /win32
# ADD BASE RSC /l 0x804 /d "NDEBUG"
# ADD RSC /l 0x804 /d "NDEBUG"
BSC32=bscmake.exe
# ADD BASE BSC32 /nologo
# ADD BSC32 /nologo
LINK32=link.exe
# ADD BASE LINK32 kernel32.lib user32.lib gdi32.lib winspool.lib comdlg32.lib advapi32.lib shell32.lib ole32.lib oleaut32.lib uuid.lib odbc32.lib odbccp32.lib /nologo /subsystem:windows /machine:I386
# ADD LINK32 kernel32.lib user32.lib gdi32.lib winspool.lib comdlg32.lib advapi32.lib shell32.lib ole32.lib oleaut32.lib uuid.lib odbc32.lib odbccp32.lib ddraw.lib winmm.lib vfw32.lib dsound.lib dinput.lib dxguid.lib /nologo /subsystem:windows /machine:I386 /out:"GAMEVISION.exe"
# Begin Target

# Name "GAMEVISION - Win32 Release"
# Begin Source File

SOURCE=.\ICON.rc
# End Source File
# Begin Source File

SOURCE=.\id.ico
# End Source File
# Begin Source File

SOURCE=.\Keydef.h
# End Source File
# Begin Source File

SOURCE=.\Main.cpp
# End Source File
# Begin Source File

SOURCE=.\Refresh.h
# End Source File
# Begin Source File

SOURCE=.\SpecialE.h
# End Source File
# Begin Source File

SOURCE=.\StdFont.H
# End Source File
# Begin Source File

SOURCE=.\StdGraph.H
# End Source File
# Begin Source File

SOURCE=.\StdInit.H
# End Source File
# Begin Source File

SOURCE=.\StdInput.h
# End Source File
# Begin Source File

SOURCE=.\StdMath.h
# End Source File
# Begin Source File

SOURCE=.\StdPoly.h
# End Source File
# Begin Source File

SOURCE=.\StdPolyT.h
# End Source File
# Begin Source File

SOURCE=.\StdSound.h
# End Source File
# Begin Source File

SOURCE=.\StdStr.H
# End Source File
# Begin Source File

SOURCE=.\StdVideo.h
# End Source File
# End Target
# End Project
