/*  Refresh.h  */

/*--------------------------------------*/
//			Show Status
/*--------------------------------------*/

long	FrameRate;
long	FrameCount,	FrameCount0;
long	FrameTime, FrameTime0, StatusTime;

// -------------------------------------

void ShowStatus(void)
{
	double	nFPS;
	char	NumBuffer[128];

	FrameCount ++;
	FrameTime = timeGetTime();
	if((FrameTime - FrameTime0) >= 500)
	{
		FrameRate = ((FrameCount - FrameCount0) * 100000)/(FrameTime - FrameTime0);
		FrameCount0 = FrameCount;
		FrameTime0 = FrameTime;
	}

	if(StatusFlag)
	{
		//	Show Screen Mode
		SetColor(0x00ff00);
		_Box(RENDER_WIDTH - 112, 3, RENDER_WIDTH - 4, 9);
		SetColor(0);
		switch(ScreenMode)
		{
			case 0:
				_OutTextXY(RENDER_WIDTH - 109, 3, "TRUECOLOR TV MODE");
				break;
			case 1:
				_OutTextXY(RENDER_WIDTH - 109, 3, "HIGHCOLOR TV MODE");
				break;
			case 2:
				_OutTextXY(RENDER_WIDTH - 109, 3, "TRUECOLOR PC MODE");
				break;
			case 3:
				_OutTextXY(RENDER_WIDTH - 109, 3, "HIGHCOLOR PC MODE");
				break;
		}

		//	Show Frame Rate
		nFPS=(double)FrameRate/100.0;
		sprintf(NumBuffer, "%.2f FPS", nFPS);
		SetColor(0xffe08f);
		_Box(RENDER_WIDTH - 112, 11, RENDER_WIDTH - 4, 17);
		SetColor(0);
		_OutTextXY(RENDER_WIDTH - 112 + (108 - StrLenEx(NumBuffer) * 6) / 2, 11, NumBuffer);

		//	Show Motion Blur Status
		switch(MotionBlurFlag)
		{
			case 1:
				SetColor(0xffc06f);
				_Box(RENDER_WIDTH - 112, 19, RENDER_WIDTH - 4, 25);
				SetColor(0);
				_OutTextXY(RENDER_WIDTH - 109, 19, "LIGHT MOTION BLUR");
				break;
			case 2:
				SetColor(0xffc04f);
				_Box(RENDER_WIDTH - 112, 19, RENDER_WIDTH - 4, 25);
				SetColor(0);
				_OutTextXY(RENDER_WIDTH - 109, 19, "HEAVY MOTION BLUR");
				break;
		}
	}
}				  

/*--------------------------------------*/
//			Refresh Screen
/*--------------------------------------*/

BYTE	MotionBlurBIT_MASK[16] = 
{
	0xFE, 0xFE, 0xFE, 0x00, 0xFE, 0xFE, 0xFE, 0x00,
	0xFC, 0xFC, 0xFC, 0x00, 0xFC, 0xFC, 0xFC, 0x00
};

void MotionBlurRenderBuffer(void)
{

	if(MotionBlurFlag==1)
	{
/*	_asm {
		LEA		ESI, [RenderBuffer]
		MOV		EDI, ESI
		ADD		EDI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2
		MOV		ECX, RENDER_HEIGHT * RENDER_WIDTH / 2

PixelMotionBlur:

		LODSD	
		MOV		EBX, [EDI]
		AND		EAX, 0x00FCFCFC
		AND		EBX, 0x00FCFCFC
		LEA		EAX, [EAX + EAX * 2]
		ADD		EAX, EBX
		SHR		EAX, 2
		STOSD

		LODSD	
		MOV		EBX, [EDI]
		AND		EAX, 0x00FCFCFC
		AND		EBX, 0x00FCFCFC
		LEA		EAX, [EAX + EAX * 2]
		ADD		EAX, EBX
		SHR		EAX, 2
		STOSD

		LOOP	PixelMotionBlur
	}
*/
		_asm {
			LEA		ESI, [RenderBuffer]
			MOV		EDI, ESI
			MOVQ	MM7, [MotionBlurBIT_MASK+8]
			ADD		EDI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2
			MOV		ECX, RENDER_HEIGHT * RENDER_WIDTH / 4
			MOVQ	MM6, MM7
			MOV		EBX, 16

PixelMotionBlur:

			MOVQ	MM0, [ESI]
			MOVQ	MM1, [ESI+8]
			
			MOVQ	MM2, [EDI]
			MOVQ	MM3, [EDI+8]

			PAND	MM0, MM6
			PAND	MM1, MM7

			PAND	MM2, MM6
			PAND	MM3, MM7

			MOVQ	MM4, MM0
			MOVQ	MM5, MM1

			PADDD	MM0, MM4
			PADDD	MM1, MM5
			
			PADDD	MM0, MM4
			PADDD	MM1, MM5

			PADDD	MM0, MM2
			PADDD	MM1, MM3

			PSRLD	MM0, 2
			PSRLD	MM1, 2

			MOVQ	[EDI], MM0
			ADD		ESI, EBX
			MOVQ	[EDI+8], MM1
			ADD		EDI, EBX

			DEC		ECX
			JNZ		PixelMotionBlur

			EMMS
		}
	}
	else
	{
		_asm {
			LEA		ESI, [RenderBuffer]
			MOV		EDI, ESI
			MOVQ	MM7, [MotionBlurBIT_MASK]
			ADD		EDI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2
			MOV		ECX, RENDER_HEIGHT * RENDER_WIDTH / 4
			MOVQ	MM6, MM7
			MOV		EBX, 16

PixelMotionBlur2:

			MOVQ	MM0, [ESI]
			MOVQ	MM1, [ESI+8]
			
			MOVQ	MM2, [EDI]
			MOVQ	MM3, [EDI+8]

			PAND	MM0, MM6
			PAND	MM1, MM7

			PAND	MM2, MM6
			PAND	MM3, MM7
			
			PADDD	MM0, MM2
			PADDD	MM1, MM3

			PSRLD	MM0, 1
			PSRLD	MM1, 1

			MOVQ	[EDI], MM0
			ADD		ESI, EBX
			MOVQ	[EDI+8], MM1
			ADD		EDI, EBX

			DEC		ECX
			JNZ		PixelMotionBlur2

			EMMS
		}
	}
}

// -------------------------------------

void CopyScreenData0(LPDWORD lpDst, long lPitch)
{
	long		lPitchOffset = lPitch + lPitch - 2 * RENDER_WIDTH * 4 + 4;
	// 2 lines - 2 x buffer_w + 1

	_asm {
		LEA		ESI, [RenderBuffer]
		CMP		MotionBlurFlag, 0
		JZ		MotionBlurFlagIsFalse
		ADD		ESI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2

MotionBlurFlagIsFalse:

		MOV		EDI, lpDst
		MOV		EDX, RENDER_HEIGHT
		CLD

CopyScreenData0_LoopY:

		MOV		ECX, RENDER_WIDTH - 1

CopyScreenData0_LoopX:

		LODSD
		STOSD
		MOV		EBX, [ESI]
		AND		EAX, 0x00FEFEFE
		AND		EBX, 0x00FEFEFE
		ADD		EAX, EBX
		SHR		EAX, 1
		STOSD

		DEC		ECX
		JNZ		CopyScreenData0_LoopX

		MOVSD

		ADD		EDI, lPitchOffset

		DEC		EDX
		JNZ		CopyScreenData0_LoopY
	}
}

// -------------------------------------

void CopyScreenData1_555(LPDWORD lpDst, long lPitch)
{
	long		lPitchOffset = lPitch + lPitch - RENDER_WIDTH * 2 * 2 + 2;
	long		Y = RENDER_HEIGHT;

	_asm {
		LEA		ESI, [RenderBuffer]
		CMP		MotionBlurFlag, 0
		JZ		MotionBlurFlagIsFalse
		ADD		ESI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2

MotionBlurFlagIsFalse:

		MOV		EDI, lpDst
		MOV		Y, RENDER_HEIGHT
		CLD

CopyScreenData1_555_LoopY:

		MOV		ECX, RENDER_WIDTH - 1

CopyScreenData1_555_LoopX:

		LODSD
		MOV		EBX, EAX
		MOV		EDX, EAX
		AND		EAX, 0xFFFF
		SHR		EDX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EDX*2]
		STOSW

		MOV		EAX, [ESI]
		AND		EBX, 0xFEFEFE
		AND		EAX, 0xFEFEFE
		ADD		EAX, EBX
		SHR		EAX, 1
		MOV		EDX, EAX
		AND		EAX, 0xFFFF
		SHR		EDX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EDX*2]
		STOSW

		DEC		ECX
		JNZ		CopyScreenData1_555_LoopX

		LODSD
		MOV		EDX, EAX
		AND		EAX, 0xFFFF
		SHR		EDX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EDX*2]
		STOSW

		ADD		EDI, lPitchOffset

		DEC		Y
		JNZ		CopyScreenData1_555_LoopY
	}
}

// -------------------------------------

void CopyScreenData1_565(LPDWORD lpDst, long lPitch)
{
	long		lPitchOffset = lPitch + lPitch - RENDER_WIDTH * 2 * 2 + 2;
	long		Y = RENDER_HEIGHT;

	_asm {
		LEA		ESI, [RenderBuffer]
		CMP		MotionBlurFlag, 0
		JZ		MotionBlurFlagIsFalse
		ADD		ESI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2

MotionBlurFlagIsFalse:

		MOV		EDI, lpDst
		CLD

CopyScreenData1_565_LoopY:

		MOV		ECX, RENDER_WIDTH - 1

CopyScreenData1_565_LoopX:

		LODSD
		MOV		EBX, EAX
		MOV		EDX, EAX
		AND		EAX, 0xFFFF
		SHR		EDX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EDX*2]
		STOSW

		MOV		EAX, [ESI]
		AND		EBX, 0xFEFEFE
		AND		EAX, 0xFEFEFE
		ADD		EAX, EBX
		SHR		EAX, 1
		MOV		EDX, EAX
		AND		EAX, 0xFFFF
		SHR		EDX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EDX*2]
		STOSW

		DEC		ECX
		JNZ		CopyScreenData1_565_LoopX

		LODSD
		MOV		EDX, EAX
		AND		EAX, 0xFFFF
		SHR		EDX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EDX*2]
		STOSW

		ADD		EDI, lPitchOffset

		DEC		Y
		JNZ		CopyScreenData1_565_LoopY
	}
}

// -------------------------------------

void CopyScreenData2(LPDWORD lpDst, long lPitch)
{
	long		lPitchOffset = lPitch - RENDER_WIDTH * 4;
	// 1 line - buffer_w

	_asm {
		LEA		ESI, [RenderBuffer]
		CMP		MotionBlurFlag, 0
		JZ		MotionBlurFlagIsFalse
		ADD		ESI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2

MotionBlurFlagIsFalse:

		MOV		EDI, lpDst
		MOV		EDX, RENDER_HEIGHT
		CLD
		MOV		EAX, lPitchOffset
		MOV		EBX, 16

CopyScreenData2_LoopY:
/*
		MOV		ECX, RENDER_WIDTH
		REP		MOVSD
*/
		MOV		ECX, RENDER_WIDTH / 4

CopyScreenData2_LoopX:

		MOVQ	MM0, [ESI]
		MOVQ	MM1, [ESI+8]
		MOVQ	[EDI], MM0
		ADD		ESI, EBX
		MOVQ	[EDI+8], MM1
		ADD		EDI, EBX

		DEC		ECX
		JNZ		CopyScreenData2_LoopX

		ADD		EDI, EAX

		DEC		EDX
		JNZ		CopyScreenData2_LoopY

		EMMS
	}
}

// -------------------------------------

void CopyScreenData3_555(LPDWORD lpDst, long lPitch)
{
	long		lPitchOffset = lPitch - RENDER_WIDTH * 2;

	_asm {
		LEA		ESI, [RenderBuffer]
		CMP		MotionBlurFlag, 0
		JZ		MotionBlurFlagIsFalse
		ADD		ESI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2

MotionBlurFlagIsFalse:

		MOV		EDI, lpDst
		MOV		EDX, RENDER_HEIGHT
		CLD

CopyScreenData3_555_LoopY:

		MOV		ECX, RENDER_WIDTH

CopyScreenData3_555_LoopX:

		LODSD
		MOV		EBX, EAX
		AND		EAX, 0xFFFF
		SHR		EBX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EBX*2]
		STOSW

		DEC		ECX
		JNZ		CopyScreenData3_555_LoopX

		ADD		EDI, lPitchOffset

		DEC		EDX
		JNZ		CopyScreenData3_555_LoopY
	}
}

// -------------------------------------

void CopyScreenData3_565(LPDWORD lpDst, long lPitch)
{
	long		lPitchOffset = lPitch - RENDER_WIDTH * 2;

	_asm {
		LEA		ESI, [RenderBuffer]
		CMP		MotionBlurFlag, 0
		JZ		MotionBlurFlagIsFalse
		ADD		ESI, RENDER_HEIGHT * RENDER_WIDTH * 4 * 2

MotionBlurFlagIsFalse:

		MOV		EDI, lpDst
		MOV		EDX, RENDER_HEIGHT
		CLD

CopyScreenData3_565_LoopY:

		MOV		ECX, RENDER_WIDTH

CopyScreenData3_565_LoopX:

		LODSD
		MOV		EBX, EAX
		AND		EAX, 0xFFFF
		SHR		EBX, 16
		MOV		AX, [RGBPACKWORDL+EAX*2]
		ADD		AX, [RGBPACKWORDH+EBX*2]
		STOSW

		DEC		ECX
		JNZ		CopyScreenData3_565_LoopX

		ADD		EDI, lPitchOffset

		DEC		EDX
		JNZ		CopyScreenData3_565_LoopY
	}
}

// -------------------------------------
//	Image Buffer for Overlay
// -------------------------------------

DWORD		StatusImageBuffer[110 * 23 + 2];

// -------------------------------------
//	Refreah Screen
// -------------------------------------

void RefreshScreen(void)
{
	DDSURFACEDESC		ddsd;
	HRESULT				ddrval;
	long				AtX, AtY;
	long				xmin, xmax, ymin, ymax;

	xmin = XMIN; xmax = XMAX; ymin = YMIN; ymax = YMAX;

	ResetClipBox();

	if(MotionBlurFlag)
	{
		MotionBlurRenderBuffer();
		SetRenderPage(BLURPAGE);
	}

	if(StatusFlag)
	{
		GetImage(RENDER_WIDTH - 112, 3, 110, 23, StatusImageBuffer);
	}

	if(MOUSEFLAG && MouseImageBuffer)
	{
		long	Width, Height;

		Width = *(MouseImageBuffer);
		Height = *(MouseImageBuffer + 1);

		AtX = MOUSEX + MOUSEATTACHX;
		AtY = MOUSEY + MOUSEATTACHY;

		GetImage(AtX, AtY, Width, Height, MouseImageBackBuffer);
		PutImageCK(AtX, AtY, MouseImageBuffer);
	}

	ShowStatus();

	ddsd.dwSize = sizeof(ddsd);
	while ((ddrval = lpDDSBack->Lock(NULL, &ddsd, 0, NULL)) == DDERR_WASSTILLDRAWING);
	if(ddrval == DD_OK)
	{
		switch(ScreenMode)
		{
			case 0:
				CopyScreenData0((LPDWORD)ddsd.lpSurface, ddsd.lPitch);
				break;
			case 1:
				if(HighColor555Flag)
					CopyScreenData1_555((LPDWORD)ddsd.lpSurface, ddsd.lPitch);
				else
					CopyScreenData1_565((LPDWORD)ddsd.lpSurface, ddsd.lPitch);
				break;
			case 2:
				CopyScreenData2((LPDWORD)ddsd.lpSurface, ddsd.lPitch);
				break;
			case 3:
				if(HighColor555Flag)
					CopyScreenData3_555((LPDWORD)ddsd.lpSurface, ddsd.lPitch);
				else
					CopyScreenData3_565((LPDWORD)ddsd.lpSurface, ddsd.lPitch);
				break;
		}
		lpDDSBack->Unlock(NULL);
	}

	while(TRUE)
	{
		ddrval = lpDDSPrimary->Flip(NULL, 0);
		if(ddrval == DD_OK)
		{	
			break;
		}
		if(ddrval == DDERR_SURFACELOST)
		{
			ddrval = RestoreDDraw();
			if(ddrval != DD_OK)
			{
				break;
			}
		}
		if(ddrval != DDERR_WASSTILLDRAWING)
		{
			break;
		}
	}

	if(MOUSEFLAG && MouseImageBuffer)
	{
		PutImage(AtX, AtY, MouseImageBackBuffer);
	}

	if(StatusFlag)
	{
		if((FrameTime - StatusTime) > 5000) StatusFlag = FALSE;
		PutImage(RENDER_WIDTH - 112, 3, StatusImageBuffer);
	}

	SetRenderPage(MAINPAGE);

	XMIN = xmin; XMAX = xmax; YMIN = ymin; YMAX = ymax;
}
