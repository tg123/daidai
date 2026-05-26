/*  StdGraph.H  */

// -------------------------------------
//			render buffer 
// -------------------------------------

#define		RENDER_WIDTH		400
#define		RENDER_HEIGHT		300

// -------------------------------------

long		StatusFlag = FALSE;
long		MotionBlurFlag = 0;

// -------------------------------------

#define SetRenderPage(x)	lpRenderBuffer = (LPDWORD)RenderBuffer + RENDER_HEIGHT * RENDER_WIDTH * (x)

#define	MAINPAGE	0
#define	ZBUFPAGE	1
#define	BLURPAGE	2
#define	BACKPAGE	3
#define	SFX1PAGE	4
#define	SFX2PAGE	5

DWORD		RenderBuffer[RENDER_HEIGHT * RENDER_WIDTH * 6];
//	6 Pages:	0	Main
//				1	Z-Buffer
//				2	Motion Blur
//				3	Backup
//				4	SFX-Calc(Water, Fire, Smoke, etc.)
//				5	SFX2 or Backup2

LPDWORD		lpRenderBuffer = (LPDWORD)RenderBuffer;

// -------------------------------------

LPDIRECTDRAW			lpDD = NULL;           // DirectDraw object
LPDIRECTDRAWSURFACE		lpDDSPrimary = NULL;   // DirectDraw primary surface
LPDIRECTDRAWSURFACE		lpDDSBack = NULL;      // DirectDraw back surface

// -------------------------------------
//			Set Line Start Offset & Brightness Table
// -------------------------------------

DWORD		LineStartOffset[RENDER_HEIGHT];
DWORD		MultipleWidth[RENDER_HEIGHT];
DWORD		Brightness[256];

// -------------------------------------

void SetLineStartOffset(void)
{
	long	y;

	// set brightness
	for(y = 0; y < 256; y ++)
	{
		Brightness[y] = y * 0x10101;
	}

	// calc line start offset
	for(y = 0; y < RENDER_HEIGHT; y ++)
	{
		LineStartOffset[y] = y * RENDER_WIDTH * 4;
		MultipleWidth[y] = y * RENDER_WIDTH;
	}
}

/*--------------------------------------*/
//			Standard Graphic Function
/*--------------------------------------*/

long	XMIN = 0,					YMIN = 0;
long	XMAX = RENDER_WIDTH - 1,	YMAX = RENDER_HEIGHT - 1;

#define SetColor(color)			CURRENTCOLOR = (color)

DWORD	CURRENTCOLOR = 0xFFFFFF;

#define CK_VALUE	0x00FF00FF

// -------------------------------------

void ResetClipBox(void)
{
	XMIN = 0;					YMIN = 0;
	XMAX = RENDER_WIDTH - 1;	YMAX = RENDER_HEIGHT - 1;
}

// -------------------------------------

void SetClipBox(long Left, long Top, long Right, long Bottom)
{
	if(Right < Left)
	{
		_asm {
			MOV		EAX, Right
			XCHG	EAX, Left
			MOV		Right, EAX
		}
	}
	if(Bottom < Top)
	{
		_asm {
			MOV		EAX, Top
			XCHG	EAX, Bottom
			MOV		Top, EAX
		}
	}
	if(Left < 0) 
		Left = 0;
	if(Right >= RENDER_WIDTH) 
		Right = RENDER_WIDTH - 1;
	if(Top < 0) 
		Top = 0;
	if(Bottom >= RENDER_HEIGHT) 
		Bottom = RENDER_HEIGHT - 1;

	XMIN=Left; YMIN=Top; XMAX=Right; YMAX=Bottom;
}

// -------------------------------------

void ClearRenderBuffer(long Page)
{
	LPDWORD lpDst = (LPDWORD)RenderBuffer + RENDER_WIDTH * RENDER_HEIGHT * Page;
	
	_asm {
		XOR		EAX, EAX
		MOV		EDI, lpDst
		MOV		ECX, RENDER_WIDTH * RENDER_HEIGHT
		REP		STOSD
	}
}

// -------------------------------------

void BackupToMotionBlurBuffer(void)
{
	_asm {
		LEA		ESI, [RenderBuffer]
		LEA		EDI, [ESI + RENDER_WIDTH * RENDER_HEIGHT * 4 * 2]
		MOV		ECX, RENDER_WIDTH * RENDER_HEIGHT
		REP		MOVSD
	}
}

// -------------------------------------

void BackupRenderBuffer(void)
{
	_asm {
		LEA		ESI, [RenderBuffer]
		LEA		EDI, [ESI + RENDER_WIDTH * RENDER_HEIGHT * 4 * 3]
		MOV		ECX, RENDER_WIDTH * RENDER_HEIGHT
		REP		MOVSD
	}
}

// -------------------------------------

void _PSet(long X, long Y)
{
	_asm {
		MOV		EAX, Y
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		ADD		EDI, EAX
		MOV		EBX, X
		LEA		EDI, [EDI+EBX*4]
		MOV		EAX, CURRENTCOLOR
		STOSD
	}
}

// -------------------------------------

void PSet(long X, long Y)
{
	if(X<XMIN || Y<YMIN || X>XMAX ||Y>YMAX) return;

	_asm {
		MOV		EAX, Y
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		ADD		EDI, EAX
		MOV		EBX, X
		LEA		EDI, [EDI+EBX*4]
		MOV		EAX, CURRENTCOLOR
		STOSD
	}
}

// -------------------------------------

DWORD Point(long X, long Y)
{
	DWORD	res;

	if(X<XMIN || Y<YMIN || X>XMAX || Y>YMAX) return 0;

	_asm {
		MOV		EAX, Y
		MOV		ESI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		ADD		ESI, EAX
		MOV		EBX, X
		LEA		ESI, [ESI+EBX*4]
		MOV		EAX, [ESI]
		MOV		res, EAX
	}

	return res;
}

// -------------------------------------

void _Line(long X1, long Y1, long X2, long Y2)
{
	long deltax, deltay, halfx, halfy, dotn;
	long x, y, dirx, diry, b;

	dirx = 1; diry = 1;
	if((deltax = X2 - X1) < 0)
	{
		deltax = -deltax;
		dirx = -1;
	}
	if((deltay = Y2 - Y1) < 0)
	{
		deltay = -deltay;
		diry = -1;
	}
	x = X1; y = Y1; b = 0;
	if(deltax < deltay)
	{
		halfy = deltay >> 1;
		dotn = deltay;
		do
		{
			_PSet(x, y);
			y += diry;
			b += deltax;
			if(b > halfy)
			{
				b -= deltay;
				x += dirx;
			}
		} while(dotn--);
    }
	else
	{
		halfx = deltax >> 1;
		dotn = deltax;
		do
		{
			_PSet(x, y);
			x += dirx;
			b += deltay;
			if(b > halfx)
			{
				b -= deltax;
				y += diry;
			}
		} while(dotn--);
	}
}

// -------------------------------------

void Line(long X1, long Y1, long X2, long Y2)
{
	long deltax, deltay, halfx, halfy, dotn;
	long x, y, dirx, diry, b;

	dirx = 1; diry = 1;
	if((deltax = X2 - X1) < 0)
	{
		deltax = -deltax;
		dirx = -1;
	}
	if((deltay = Y2 - Y1) < 0)
	{
		deltay = -deltay;
		diry = -1;
	}
	x = X1; y = Y1; b = 0;
	if(deltax < deltay)
	{
		halfy = deltay >> 1;
		dotn = deltay;
		do
		{
			PSet(x, y);
			y += diry;
			b += deltax;
			if(b > halfy)
			{
				b -= deltay;
				x += dirx;
			}
		} while(dotn--);
    }
	else
	{
		halfx = deltax >> 1;
		dotn = deltax;
		do
		{
			PSet(x, y);
			x += dirx;
			b += deltay;
			if(b > halfx)
			{
				b -= deltax;
				y += diry;
			}
		} while(dotn--);
	}
}

// -------------------------------------

void _Box(long Left, long Top, long Right, long Bottom)
{
	_asm {
		MOV		EAX, Top
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		ADD		EDI, EAX
		MOV		EBX, Left
		LEA		EDI, [EDI+EBX*4]

		MOV		EAX,CURRENTCOLOR


		MOV		ECX,Right
		INC		ECX
		SUB		ECX,Left	// ecx=width of box

		MOV		EBX,Bottom
		INC		EBX
		SUB		EBX,Top		// ebx=height of box
		
		MOV		ESI,EDI
		MOV		EDX,ECX

_DrawBox_LoopY:

		REP		STOSD
		ADD		ESI,RENDER_WIDTH * 4
		MOV		EDI,ESI
		MOV		ECX,EDX
		DEC		EBX
		JNZ		_DrawBox_LoopY
	}
}

void Box(long Left, long Top, long Right, long Bottom)
{
	if(Right < Left)
	{
		_asm {
			MOV		EAX, Right
			XCHG	EAX, Left
			MOV		Right, EAX
		}
	}

	if(Bottom < Top)
	{
		_asm {
			MOV		EAX, Top
			XCHG	EAX, Bottom
			MOV		Top, EAX
		}
	}

	if(Left < XMIN)		Left = XMIN;
	if(Right >= XMAX)	Right = XMAX;
	if(Top < YMIN)		Top = YMIN;
	if(Bottom >= YMAX)	Bottom = YMAX;

	_asm {
		MOV		EAX, Top
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		ADD		EDI, EAX
		MOV		EBX, Left
		LEA		EDI, [EDI+EBX*4]

		MOV		EAX,CURRENTCOLOR

		MOV		ECX,Right
		INC		ECX
		SUB		ECX,Left	// ecx=width of box

		MOV		EBX,Bottom
		INC		EBX
		SUB		EBX,Top		// ebx=height of box
		
		MOV		ESI,EDI
		MOV		EDX,ECX

DrawBox_LoopY:

		REP		STOSD
		ADD		ESI,RENDER_WIDTH * 4
		MOV		EDI,ESI
		MOV		ECX,EDX
		DEC		EBX
		JNZ		DrawBox_LoopY
	}
}

// -------------------------------------

void _PutImage(long X, long Y, LPDWORD Image)
{
	long	ImageW, ImageH;

	_asm {
		MOV		EAX, Y
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		MOV		ESI, Image
		ADD		EDI, EAX
		MOV		EBX, X
		LODSD	
		MOV		ImageW, EAX			//	ImageW = *Image;
		LODSD	
		MOV		ImageH, EAX			//	ImageH = *(Image + 1);
		LEA		EDI, [EDI+EBX*4]	
		MOV		EDX, ImageH
		MOV		EBX, RENDER_WIDTH
		SUB		EBX, ImageW
		SHL		EBX, 2

_PutImage_LOOPY:

		MOV		ECX, ImageW
		REP		MOVSD
		ADD		EDI, EBX
		DEC		EDX
		JNZ		_PutImage_LOOPY
	}
}

// -------------------------------------

void PutImage(long X, long Y, LPDWORD Image)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(X > XMAX || Y > YMAX)
		return;						//	Out of range

	ImageW = *(Image ++);
	ImageH = *(Image ++);

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN)
		return;						//	Out of range

	PasteW = ImageW;	
	PasteH = ImageH;

	if(X < XMIN)
	{
		temp = XMIN - X;
		Image += temp;
		PasteW -= temp;
		X=XMIN;	
	}

	if(Y < YMIN)
	{
		temp = YMIN - Y;
		Image += (temp * ImageW);
		PasteH -= temp;
		Y=YMIN;	
	}

	temp = X + PasteW - 1;
	if(temp > XMAX)
	{
		PasteW -= (temp - XMAX);
	}

	temp = Y + PasteH - 1;
	if(temp > YMAX)
	{
		PasteH -= (temp - YMAX);
	}

	_asm {
		MOV		EBX, X
		MOV		ECX, Y
		MOV		EDI, lpRenderBuffer
		MOV		ECX, [LineStartOffset+ECX*4]
		LEA		EDI, [EDI+EBX*4]
		MOV		ESI, Image
		ADD		EDI, ECX

		MOV		EBX, ImageW
		SUB		EBX, PasteW
		SHL		EBX, 2

		MOV		EDX, RENDER_WIDTH
		SUB		EDX, PasteW
		SHL		EDX, 2

PutImage_LOOPY:

		MOV		ECX, PasteW
		REP		MOVSD
		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_LOOPY
	}
}

// -------------------------------------

void _PutImageCK(long X, long Y, LPDWORD Image)
{
	long	ImageW, ImageH;

	_asm {
		MOV		EAX, Y
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		MOV		ESI, Image
		ADD		EDI, EAX
		MOV		EBX, X
		LODSD	
		MOV		ImageW, EAX			//	ImageW = *Image;
		LODSD	
		MOV		ImageH, EAX			//	ImageH = *(Image + 1);
		LEA		EDI, [EDI+EBX*4]	
		MOV		EDX, ImageH
		MOV		EBX, RENDER_WIDTH
		SUB		EBX, ImageW
		SHL		EBX, 2

_PutImageCK_LOOPY:

		MOV		ECX, ImageW

_PutImageCK_LOOPX:

		LODSD
		CMP		EAX, CK_VALUE
		JZ		_PutImageCK_LOOP_SKIP
		STOSD
		DEC		ECX
		JNZ		_PutImageCK_LOOPX

		ADD		EDI, EBX
		DEC		EDX
		JNZ		_PutImageCK_LOOPY
	}

	return;

_PutImageCK_LOOP_SKIP:

	_asm {
		ADD		EDI, 4
		DEC		ECX
		JNZ		_PutImageCK_LOOPX

		ADD		EDI, EBX
		DEC		EDX
		JNZ		_PutImageCK_LOOPY
	}
}

// -------------------------------------

void PutImageCK(long X, long Y, LPDWORD Image)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(X > XMAX || Y > YMAX)
		return;						//	Out of range

	ImageW = *(Image ++);
	ImageH = *(Image ++);

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN)
		return;						//	Out of range

	PasteW = ImageW;	
	PasteH = ImageH;

	if(X < XMIN)
	{
		temp = XMIN - X;
		Image += temp;
		PasteW -= temp;
		X=XMIN;	
	}

	if(Y < YMIN)
	{
		temp = YMIN - Y;
		Image += (temp * ImageW);
		PasteH -= temp;
		Y=YMIN;	
	}

	temp = X + PasteW - 1;
	if(temp > XMAX)
	{
		PasteW -= (temp - XMAX);
	}

	temp = Y + PasteH - 1;
	if(temp > YMAX)
	{
		PasteH -= (temp - YMAX);
	}

	_asm {
		MOV		EBX, X
		MOV		ECX, Y
		MOV		EDI, lpRenderBuffer
		MOV		ECX, [LineStartOffset+ECX*4]
		LEA		EDI, [EDI+EBX*4]
		MOV		ESI, Image
		ADD		EDI, ECX

		MOV		EBX, ImageW
		SUB		EBX, PasteW
		SHL		EBX, 2

		MOV		EDX, RENDER_WIDTH
		SUB		EDX, PasteW
		SHL		EDX, 2

PutImage_CK_LOOPY:

		MOV		ECX, PasteW

PutImage_CK_LOOPX:

		LODSD
		CMP		EAX, CK_VALUE
		JZ		PutImage_CK_LOOP_SKIP
		STOSD

		DEC		ECX
		JNZ		PutImage_CK_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_LOOPY
	}

	return;

PutImage_CK_LOOP_SKIP:

	_asm {
		ADD		EDI, 4
		DEC		ECX
		JNZ		PutImage_CK_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_LOOPY
	}
}

// -------------------------------------

void PutImageCKST(long X, long Y, LPDWORD Image)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(X > XMAX || Y > YMAX)
		return;						//	Out of range

	ImageW = *(Image ++);
	ImageH = *(Image ++);

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN)
		return;						//	Out of range

	PasteW = ImageW;	
	PasteH = ImageH;

	if(X < XMIN)
	{
		temp = XMIN - X;
		Image += temp;
		PasteW -= temp;
		X=XMIN;	
	}

	if(Y < YMIN)
	{
		temp = YMIN - Y;
		Image += (temp * ImageW);
		PasteH -= temp;
		Y=YMIN;	
	}

	temp = X + PasteW - 1;
	if(temp > XMAX)
	{
		PasteW -= (temp - XMAX);
	}

	temp = Y + PasteH - 1;
	if(temp > YMAX)
	{
		PasteH -= (temp - YMAX);
	}

	_asm {
		MOV		EBX, X
		MOV		ECX, Y
		MOV		EDI, lpRenderBuffer
		MOV		ECX, [LineStartOffset+ECX*4]
		LEA		EDI, [EDI+EBX*4]
		MOV		ESI, Image
		ADD		EDI, ECX

		MOV		EBX, ImageW
		SUB		EBX, PasteW
		SHL		EBX, 2

		MOV		EDX, RENDER_WIDTH
		SUB		EDX, PasteW
		SHL		EDX, 2

PutImage_CK_ST_LOOPY:

		MOV		ECX, PasteW

PutImage_CK_ST_LOOPX:

		LODSD
		CMP		EAX, CK_VALUE
		JZ		PutImage_CK_ST_LOOP_SKIP
		MOV     EAX, CURRENTCOLOR
		STOSD

		DEC		ECX
		JNZ		PutImage_CK_ST_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_ST_LOOPY
	}

	return;

PutImage_CK_ST_LOOP_SKIP:

	_asm {
		ADD		EDI, 4
		DEC		ECX
		JNZ		PutImage_CK_ST_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_ST_LOOPY
	}
}

// -------------------------------------

LPDWORD AllocImageBuffer(long ImageW, long ImageH)
{
	LPVOID		res;

	res = calloc(ImageW * ImageH + 2, 4);

	return (LPDWORD)res;
}

// -------------------------------------

void FreeImageBuffer(LPDWORD Image)
{
	if(Image != NULL) free(Image);
}

// -------------------------------------

void _GetImage(long X, long Y, long ImageW, long ImageH, LPDWORD Image)
{
	if(Image == NULL) return;

	*(Image++) = ImageW;
	*(Image++) = ImageH;

	_asm {
		MOV		EAX, Y
		MOV		ESI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		MOV		EDI, Image
		ADD		ESI, EAX
		MOV		EBX, X
		LEA		ESI, [ESI+EBX*4]
		MOV		EDX, ImageH
		MOV		EBX, RENDER_WIDTH
		SUB		EBX, ImageW
		SHL		EBX, 2

_GetImage_LOOPY:

		MOV		ECX, ImageW
		REP		MOVSD
		ADD		ESI, EBX
		DEC		EDX
		JNZ		_GetImage_LOOPY
	}
}

// -------------------------------------

void GetImage(long X, long Y, long ImageW, long ImageH, LPDWORD Image)
{
	long	PasteW, PasteH;
	long	temp;

	if(Image == NULL) return;

	if(X > XMAX || Y > YMAX)
		return;						//	Out of range

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN)
		return;						//	Out of range

	*(Image++) = ImageW;
	*(Image++) = ImageH;

	PasteW = ImageW;	
	PasteH = ImageH;

	if(X < XMIN)
	{
		temp = XMIN - X;
		Image += temp;
		PasteW -= temp;
		X=XMIN;	
	}

	if(Y < YMIN)
	{
		temp = YMIN - Y;
		Image += (temp * ImageW);
		PasteH -= temp;
		Y=YMIN;	
	}

	temp = X + PasteW - 1;
	if(temp > XMAX)
	{
		PasteW -= (temp - XMAX);
	}

	temp = Y + PasteH - 1;
	if(temp > YMAX)
	{
		PasteH -= (temp - YMAX);
	}

	_asm {
		MOV		EBX, X
		MOV		ECX, Y
		MOV		ESI, lpRenderBuffer
		MOV		ECX, [LineStartOffset+ECX*4]
		LEA		ESI, [ESI+EBX*4]
		MOV		EDI, Image
		ADD		ESI, ECX

		MOV		EBX, ImageW
		SUB		EBX, PasteW
		SHL		EBX, 2

		MOV		EDX, RENDER_WIDTH
		SUB		EDX, PasteW
		SHL		EDX, 2

GetImage_LOOPY:

		MOV		ECX, PasteW
		REP		MOVSD
		ADD		EDI, EBX
		ADD		ESI, EDX
		DEC		PasteH
		JNZ		GetImage_LOOPY
	}
}

// -------------------------------------
//			Graphics File Function
// -------------------------------------

/*
	PPM Format:

		P6
		# Created by Paint Shop Pro 5
		48 55
		255
		... data ...
*/

LPDWORD LoadPPMImageFile(LPSTR filename)
{
	char	fbuf[128];
	BYTE	Dot[4];
	long	PPMw, PPMh;
	long	i, j, n=0;
	LPDWORD	lpData;
	LPDWORD	res = NULL;
	FILE	*fp;

	fp=fopen(filename,"rb");
	if(fp == NULL)
	{
		InitFail("Load Image File Fail");
		return NULL;
	}

	fread(fbuf, 1, 128, fp);

	for(i = 0; i < 128; i ++)
	{
		if(fbuf[i] == 0x0A)
		{
			n++;
			if(n == 2)
			{
				char	*stopstring;

				PPMw = strtol(fbuf + i + 1, &stopstring, 10);
				PPMh = strtol(stopstring + 1, &stopstring, 10);
			}
			else
			if(n == 4)
			{

				res = AllocImageBuffer(PPMw, PPMh);
	
				lpData = res;
				
				*(lpData ++) = PPMw;
				*(lpData ++) = PPMh;

				fseek(fp, i + 1, SEEK_SET);

				n = PPMw * PPMh;

				for(j = 0; j < n; j ++)
				{
					fread(Dot, 3, 1, fp);
					*(lpData ++)=(Dot[0]<<16) + (Dot[1]<<8) + Dot[2];
				}
			}
		}
	}
	fclose(fp);
	return res;
}

// -------------------------------------

void ClosePicFile(LPDWORD Image)
{
	FreeImageBuffer(Image);
}

