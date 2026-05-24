/*  StdInit.H  */

#define TITLE "\"DAIDAI\" WORM v1.0.04"
#define NAME  "EOLITH GAME ENGINE    COPYRIGHT(C)FAN YIPENG, 1999"

// -------------------------------------

#include <windows.h>
#include <mmsystem.h>

#include <ddraw.h>

#include <stdio.h>
#include <stdlib.h>

// -------------------------------------

#define RELEASE(x) if (x != NULL) { x -> Release(); x = NULL; }

// -------------------------------------

#pragma pack (16)

// -------------------------------------

void InitFail(LPSTR msg);

// -------------------------------------

HWND		hWndCopy;
HINSTANCE	hInstanceCopy;

BOOL		bActive;
BOOL		bLive = TRUE;

#include "StdMath.H"
#include "StdStr.H"

#include "StdGraph.H"
#include "StdFont.H"
#include "StdPoly.H"
#include "StdPolyT.H"

#include "SpecialE.H"

#include "StdInput.H"
#include "StdSound.H"
#include "StdVideo.H"

// -------------------------------------

void InitGame(void);
void GameLoop(void);
void ExitGame(void);

// -------------------------------------

BOOL		MMXFOUND = FALSE;		// MMX exist flag

/*--------------------------------------*/
//			check MMX CPU
/*--------------------------------------*/

#define CPUID	__asm _emit 0x0F __asm _emit 0xA2

void CheckMMX(void)
{
		
	_asm {
		PUSHFD
		POP		EAX
		XOR		EAX, 0x00200000
		PUSH	EAX
		POPFD
		PUSHFD
		POP		EDX
		CMP		EAX, EDX
		JNE		MMXNotFound

		XOR		EAX, EAX
		CPUID
		OR		EAX, EAX
		JZ		MMXNotFound

		MOV		EAX, 1
		CPUID
		TEST	EDX, 00800000H
		JZ		MMXNotFound
	}
	MMXFOUND = TRUE;
	return;

MMXNotFound:
	MMXFOUND = FALSE;
	return;
}

/*--------------------------------------*/
//			DirectDraw 
/*--------------------------------------*/

// -------------------------------------

void ReleaseDDraw(void)
{
	RELEASE(lpDDSBack);
	RELEASE(lpDDSPrimary);
	RELEASE(lpDD);
}

// -------------------------------------

int			ScreenW,	ScreenH;
int			BitDepth,	ScreenMode = -1;

BOOL		HighColor555Flag;

// -------------------------------------

WORD		RGBPACKWORDL[0x10000];
WORD		RGBPACKWORDH[0x10000];

void InitRGBPACKWORD(void)
{
	long	i;
	long	r, g, b;
		
	if(HighColor555Flag)
	{
		for(i=0; i<0x10000; i++)
		{
			r = (i & 0xF8) << 7;
			RGBPACKWORDH[i] = (WORD)r;
		}
		for(i=0; i<0x10000; i++)
		{
			g = (i & 0xF800) >> 6;
			b = (i & 0x00F8) >> 3;
			RGBPACKWORDL[i] = (WORD)(g + b);
		}
	}
	else
	{
		for(i=0; i<0x10000; i++)
		{
			r = (i & 0xF8) << 8;
			RGBPACKWORDH[i] = (WORD)r;
		}
		for(i=0; i<0x10000; i++)
		{
			g = (i & 0xFC00) >> 5;
			b = (i & 0x00F8) >> 3;
			RGBPACKWORDL[i] = (WORD)(g + b);
		}
	}
}

// -------------------------------------

BOOL StartDDraw(int Mode)
{
    DDSURFACEDESC	ddsd;
    DDSCAPS			ddscaps;
 	DDPIXELFORMAT	ddpf;
	HRESULT			ddrval;

	switch(Mode)
	{
		case 0:		// 2 x 32
			ScreenW = RENDER_WIDTH * 2;
			ScreenH = RENDER_HEIGHT * 2;
			BitDepth = 32;
			break;
		case 1:		// 2 x 16
			ScreenW = RENDER_WIDTH * 2;
			ScreenH = RENDER_HEIGHT * 2;
			BitDepth = 16;
			break;
		case 2:		// 1 x 32
			ScreenW = RENDER_WIDTH;
			ScreenH = RENDER_HEIGHT;
			BitDepth = 32;
			break;
		case 3:		// 1 x 16
			ScreenW = RENDER_WIDTH;
			ScreenH = RENDER_HEIGHT;
			BitDepth = 16;
			break;
		default:
			return FALSE;
	}

	//	release DDraw object before new init
	ReleaseDDraw();

    //  create the main DirectDraw object
    ddrval = DirectDrawCreate(NULL, &lpDD, NULL);
    if(ddrval != DD_OK)
    {
		return FALSE;
    }

    //  Get exclusive mode
    ddrval = lpDD->SetCooperativeLevel(hWndCopy, DDSCL_EXCLUSIVE | DDSCL_FULLSCREEN);

    if(ddrval != DD_OK)
    {
		return FALSE;
    }

    // Set the video mode
    ddrval = lpDD->SetDisplayMode(ScreenW, ScreenH, BitDepth);
    if(ddrval != DD_OK)
    {
		return FALSE;
    }

    // Create the primary surface with 1 back buffer
    ddsd.dwSize = sizeof(ddsd);
    ddsd.dwFlags = DDSD_CAPS | DDSD_BACKBUFFERCOUNT;
    ddsd.ddsCaps.dwCaps = DDSCAPS_PRIMARYSURFACE |
		DDSCAPS_FLIP |
		DDSCAPS_COMPLEX;
    ddsd.dwBackBufferCount = 1;

    ddrval = lpDD->CreateSurface(&ddsd, &lpDDSPrimary, NULL);

	// Create the primary surface failed
    if(ddrval != DD_OK)
    {
		return FALSE;
    }

	// Create the back surface failed
    ddscaps.dwCaps = DDSCAPS_BACKBUFFER;
    ddrval = lpDDSPrimary->GetAttachedSurface(&ddscaps, &lpDDSBack);
    if(ddrval != DD_OK)
    {
		return FALSE;
    }

	if(BitDepth == 16)
	{
		// Get Pixel Format
		ddpf.dwSize = sizeof(ddpf);
		ddrval = lpDDSPrimary->GetPixelFormat(&ddpf);
	    if(ddrval != DD_OK)
		{
			return FALSE;
	    }

		WORD	GBitMask = (WORD)ddpf.dwGBitMask;
	
		if(GBitMask == 0x03E0)
		{
			HighColor555Flag = TRUE;
		}
		else
		if(GBitMask == 0x07E0)
		{
			HighColor555Flag = FALSE;
		}
		else
		{	// The Video Card doesn't support 5:5:5 or 5:6:5 HighColor
			return FALSE;
		}
		InitRGBPACKWORD();
	}

	// clear primary surface
	ddsd.dwSize = sizeof(ddsd);
	while ((ddrval = lpDDSPrimary->Lock(NULL, &ddsd, 0, NULL)) == DDERR_WASSTILLDRAWING);
	if(ddrval == DD_OK)
	{
		LPBYTE	lpDst = (LPBYTE)ddsd.lpSurface;
		DWORD	FillSize = ScreenH * ddsd.lPitch;
		_asm {
			MOV		EDI, lpDst
			MOV		ECX, FillSize
			SHR		ECX, 2
			XOR		EAX, EAX
			CLD
			REP		STOSD
		}
		lpDDSPrimary->Unlock(NULL);
	}

	// clear back surface
	ddsd.dwSize = sizeof(ddsd);
	while ((ddrval = lpDDSBack->Lock(NULL, &ddsd, 0, NULL)) == DDERR_WASSTILLDRAWING);
	if(ddrval == DD_OK)
	{
		LPBYTE	lpDst = (LPBYTE)ddsd.lpSurface;
		DWORD	FillSize = ScreenH * ddsd.lPitch;
		_asm {
			MOV		EDI, lpDst
			MOV		ECX, FillSize
			SHR		ECX, 2
			XOR		EAX, EAX
			CLD
			REP		STOSD
		}
		lpDDSBack->Unlock(NULL);
	}

	ScreenMode = Mode;
	return TRUE;
}

// -------------------------------------

BOOL InitDDraw(void)
{
	int		i;

	for(i=0; i<4; i++)
	{
		if(StartDDraw(i))
		{
			ClearRenderBuffer(0);
			ClearRenderBuffer(2);
			return TRUE;
		}
	}

	return FALSE;
}

// -------------------------------------

HRESULT RestoreDDraw(void)
{
	DDSURFACEDESC	ddsd;
    HRESULT			ddrval;

	if(lpDDSPrimary)
	{
		ddrval = lpDDSPrimary->Restore();
		{
			// clear primary surface
			ddsd.dwSize = sizeof(ddsd);
			while ((ddrval = lpDDSPrimary->Lock(NULL, &ddsd, 0, NULL)) == DDERR_WASSTILLDRAWING);
			if(ddrval == DD_OK)
			{
				LPBYTE	lpDst = (LPBYTE)ddsd.lpSurface;
				DWORD	FillSize = ScreenH * ddsd.lPitch;
				_asm {
					MOV		EDI, lpDst
					MOV		ECX, FillSize
					SHR		ECX, 2
					XOR		EAX, EAX
					CLD
					REP		STOSD
				}
				lpDDSPrimary->Unlock(NULL);
			}
		}

		if(ddrval==DD_OK)
		{
			if(lpDDSBack)
			{
				ddrval = lpDDSBack->Restore();

				// clear back surface
				ddsd.dwSize = sizeof(ddsd);
				while ((ddrval = lpDDSBack->Lock(NULL, &ddsd, 0, NULL)) == DDERR_WASSTILLDRAWING);
				if(ddrval == DD_OK)
				{
					LPBYTE	lpDst = (LPBYTE)ddsd.lpSurface;
					DWORD	FillSize = ScreenH * ddsd.lPitch;
					_asm {
						MOV		EDI, lpDst
						MOV		ECX, FillSize
						SHR		ECX, 2
						XOR		EAX, EAX
						CLD
						REP		STOSD
					}
					lpDDSBack->Unlock(NULL);
				}
			}
		}
	}
    return ddrval;
}

/*--------------------------------------*/
//			Release Code
/*--------------------------------------*/

void ReleaseObjects(void)
{
	ReleaseDSound();
	ReleaseDDraw();
	ReleaseDInput();
}

/*--------------------------------------*/
//			Init Fail
/*--------------------------------------*/

void InitFail(LPSTR msg)
{
    ReleaseObjects();
    MessageBox(hWndCopy, msg, "MESSAGE", MB_OK);
    DestroyWindow(hWndCopy);
}

/*--------------------------------------*/
//	Refresh Screen Code
/*--------------------------------------*/

#include "Refresh.H"

/*--------------------------------------*/
//			Already Run
/*--------------------------------------*/

BOOL AlreadyRun(void)
{
	HWND FirsthWnd, FirstChildhWnd;

	if((FirsthWnd = FindWindow(NULL, TITLE)) != NULL)
	{
		FirstChildhWnd = GetLastActivePopup(FirsthWnd);
		BringWindowToTop(FirsthWnd);
	
		if(FirsthWnd != FirstChildhWnd)
		{
			BringWindowToTop(FirstChildhWnd);
		}
		
		ShowWindow(FirsthWnd, SW_SHOWNORMAL);
		
		return TRUE;
	}
	
	return FALSE;
}

/*--------------------------------------*/
//			Window Proc
/*--------------------------------------*/

long FAR PASCAL WindowProc(HWND hWnd, UINT message, 
                            WPARAM wParam, LPARAM lParam)
{
    switch(message)
    {
    case WM_ACTIVATEAPP:
		bActive = (!(wParam == WA_INACTIVE));

		if(bActive)
		{
			// Keyboard syncAcquire on
			if(lpKeyboard) lpKeyboard->Acquire();

			KEYSTARTCOUNTER = KEYENDCOUNTER;

			// Video Sound syncPlay on
			if(VideoPlayingFlag)
			{
				if(lpAudioDataBuffer)
				{
					lpAudioDataBuffer->Play(NULL, NULL, 0);
				}
			}
		}
		else
		{
			// Keyboard syncAcquire off
			if(lpKeyboard) lpKeyboard->Unacquire();

			// Video Sound syncPlay off
			if(VideoPlayingFlag)
			{
				if(lpAudioDataBuffer)
				{
					lpAudioDataBuffer->Stop();
				}
			}
		}
        break;

    case WM_CREATE:
        break;

    case WM_SETCURSOR:
        SetCursor(NULL);
        return TRUE;

    case WM_SYSKEYDOWN:
        switch(wParam)
        {
			case VK_F10:	// TV/PC-MODE Switch
				StatusTime = timeGetTime();
				StatusFlag = TRUE;
				if(ScreenMode > 1)
				{
					ScreenMode -= 2;
					if(StartDDraw(ScreenMode) == FALSE)
					{
						if(!InitDDraw())
						{
							InitFail("Init DirectDraw Fail");
							return NULL;
						}
					}
				}
				else
				{
					ScreenMode += 2;
					if(StartDDraw(ScreenMode) == FALSE)
					{
						if(!InitDDraw())
						{
							InitFail("Init DirectDraw Fail");
							return NULL;
						}
					}
				}
            break;
		}
        break;

    case WM_KEYDOWN:
        switch(wParam)
        {
/*			case VK_F9:
				StatusTime = timeGetTime();
				StatusFlag = TRUE;
				if(ScreenMode%2)
				{
					ScreenMode &= 2;
					if(StartDDraw(ScreenMode) == FALSE)
					{
						if(!InitDDraw())
						{
							InitFail("Init DirectDraw Fail");
							return NULL;
						}
					}
				}
				else
				{
					ScreenMode |= 1;
					if(StartDDraw(ScreenMode) == FALSE)
					{
						if(!InitDDraw())
						{
							InitFail("Init DirectDraw Fail");
							return NULL;
						}
					}
				}
            break;
*/
			case VK_F11:	// Motion Blur Switch
				MotionBlurFlag ++;
				if(MotionBlurFlag > 2)
				{
					MotionBlurFlag = 0;
				}

				StatusTime = timeGetTime();
				StatusFlag = TRUE;
//				ClearRenderBuffer(2);
				BackupToMotionBlurBuffer();
			break;

			case VK_F12:	// Status On/Off
				StatusTime = timeGetTime();
				StatusFlag = !StatusFlag;
            break;

			case VK_ESCAPE:
				if(VideoPlayingFlag)
					VideoPlayingFlag = FALSE;
				else
				{
					bActive = FALSE;
					bLive = FALSE;
					DestroyWindow(hWnd);
				}
			    return 0;
		}
        break;

    case WM_DESTROY:
		if(VideoPlayingFlag)
		{
			VideoPlayingFlag = FALSE;	// stop play video
			bLive = FALSE;				// program need exit
		}
		else
		{
			bActive = FALSE;
			bLive = FALSE;

			ReleaseObjects();
		    PostQuitMessage(0);
		}
        break;
    }

    return DefWindowProc(hWnd, message, wParam, lParam);
}

/*--------------------------------------*/
//			Do Init
/*--------------------------------------*/

BOOL doInit(HINSTANCE hInstance, int nCmdShow)
{
    HWND                hwnd;
    WNDCLASS            wc;

    //  set up and register window class
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WindowProc;
    wc.cbClsExtra = 0;
    wc.cbWndExtra = 0;
    wc.hInstance = hInstance;
    wc.hIcon = LoadIcon(hInstance, "PROG_ICON");
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH )GetStockObject(BLACK_BRUSH);
    wc.lpszMenuName = NAME;
    wc.lpszClassName = NAME;
    RegisterClass(&wc);
    
    //  create a window
    hwnd = CreateWindowEx(WS_EX_TOPMOST,
                          NAME,
                          TITLE,
                          WS_POPUP,
                          0,
                          0,
                          GetSystemMetrics(SM_CXSCREEN),
                          GetSystemMetrics(SM_CYSCREEN),
                          NULL,
                          NULL,
                          hInstance,
                          NULL);

    if(!hwnd) return FALSE;

    ShowWindow(hwnd, nCmdShow);
    UpdateWindow(hwnd);

    hWndCopy = hwnd;
	hInstanceCopy = hInstance;

	////////////////
	// Init system
	////////////

	SetLineStartOffset();	// Set Line Start Offset for fast op

	CheckMMX();				// Check MMX and set flag
	if(MMXFOUND == FALSE)
	{
		InitFail("MMX CPU required");
		return FALSE;
	}

	if(!InitDInput())					// Init DInput Object
	{
		InitFail("Init DirectInput Fail");
		return FALSE;
	}

	if(!InitDDraw())					// Init DDraw Object
	{
		InitFail("Init DirectDraw Fail");
		return FALSE;
	}

	if(!InitDSound())
	{
		ReleaseDSound();
		InitDirectSoundDefault();
//		InitFail("Init DirectSound Fail");
//		return FALSE;
	}

	StatusTime = timeGetTime();

    return TRUE;
} 

/*--------------------------------------*/
//			Win Main
/*--------------------------------------*/

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,
                   LPSTR lpCmdLine, int nCmdShow)
{
    MSG		msg;
	HANDLE	hMutex;

	hMutex = CreateMutex(NULL, TRUE, TITLE);
	if(GetLastError() == ERROR_ALREADY_EXISTS) return NULL;

	if(!doInit(hInstance,nCmdShow))
        return FALSE;

	InitGame();

	// game loop
    while(bLive)
    {
        if(PeekMessage(&msg, NULL, 0, 0, PM_NOREMOVE))
        {
            if (!GetMessage(&msg, NULL, 0, 0)) return msg.wParam;
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
		else
		{
	        if(bActive)
		    {	// Put render code here
				KeyboardFunc();
				GameLoop();
			}
	        else
		    {	// Make sure we go to sleep if we have nothing else to do
				WaitMessage();
			}
		}
	}

	ExitGame();

	return NULL;
} 

