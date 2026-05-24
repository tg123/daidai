/*  SpecailE.H  */

// -------------------------------------
//	Specail PutImage
// -------------------------------------

// -------------------------------------

void PutImageAD(long X, long Y, LPDWORD Image)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(X > XMAX || Y > YMAX) return;

	ImageW = *(Image ++);
	ImageH = *(Image ++);

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN) return;

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

PutImage_AD_LOOPY:

		MOV		ECX, PasteW

PutImage_AD_LOOPX:

		LODSD

		MOVD		MM1, [EDI]
		MOVD		MM0, EAX
		PADDUSB		MM0, MM1
		MOVD		EAX, MM0

		STOSD

		DEC		ECX
		JNZ		PutImage_AD_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX

		DEC		PasteH
		JNZ		PutImage_AD_LOOPY
		EMMS
	}
}

// -------------------------------------

void PutImageSB(long X, long Y, LPDWORD Image)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(X > XMAX || Y > YMAX) return;

	ImageW = *(Image ++);
	ImageH = *(Image ++);

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN) return;

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

PutImage_SB_LOOPY:

		MOV		ECX, PasteW

PutImage_SB_LOOPX:

		LODSD

		MOVD		MM1, EAX
		MOVD		MM0, [EDI]
		PSUBUSB		MM0, MM1
		MOVD		EAX, MM0

		STOSD

		DEC		ECX
		JNZ		PutImage_SB_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX

		DEC		PasteH
		JNZ		PutImage_SB_LOOPY
		EMMS
	}
}

// -------------------------------------

void PutImageBR(long X, long Y, LPDWORD Image, long Bright)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(Bright <= 0)
	{
		SetColor(0);
		Box(X, Y, X + (*Image) -1, Y + (*(Image + 1)) - 1);
		return;
	}
	if(Bright > 255)
	{
		PutImage(X, Y, Image);
		return;
	}

	if(X > XMAX || Y > YMAX) return;

	ImageW = *(Image ++);
	ImageH = *(Image ++);

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN) return;

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

	for(temp = 0; temp < 4; temp ++)
	{
		ALPHA1[temp] = (WORD)Bright;
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

		MOVQ		MM3, [ALPHA1]		// MM3 = Alpha1		(64)

PutImage_BR_LOOPY:

		MOV		ECX, PasteW

PutImage_BR_LOOPX:

		LODSD

		MOVD		MM1, EAX			// MM1 = [ESI]		(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)

		PMULLW		MM1, MM3

		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1

		STOSD

		DEC		ECX
		JNZ		PutImage_BR_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX

		DEC		PasteH
		JNZ		PutImage_BR_LOOPY
		EMMS
	}
}

// -------------------------------------

void PutImageAB(long X, long Y, LPDWORD Image, long Alpha)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(Alpha <= 0)
	{
		return;
	}
	if(Alpha > 255)
	{
		PutImage(X, Y, Image);
		return;
	}

	if(X > XMAX || Y > YMAX) return;

	ImageW = *(Image ++);
	ImageH = *(Image ++);

	if(X + ImageW <= XMIN || Y + ImageH <= YMIN) return;

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

	for(temp = 0; temp < 4; temp ++)
	{
		ALPHA1[temp] = (WORD)Alpha;
		ALPHA2[temp] = (WORD)(256 - Alpha);
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

		MOVQ		MM3, [ALPHA1]		// MM3 = Alpha1		(64)
		MOVQ		MM4, [ALPHA2]		// MM4 = Alpha2		(64)

PutImage_AB_LOOPY:

		MOV		ECX, PasteW

PutImage_AB_LOOPX:

		LODSD

		MOVD		MM1, EAX			// MM1 = [ESI]		(32)
		MOVD		MM2, [EDI]			// MM2 = [EDI]		(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)
		PUNPCKLBW	MM2, MM0			// MM2				(16x4)

		PMULLW		MM1, MM3
		PMULLW		MM2, MM4

		PADDUSW		MM1, MM2
		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1

		STOSD

		DEC		ECX
		JNZ		PutImage_AB_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX

		DEC		PasteH
		JNZ		PutImage_AB_LOOPY
		EMMS
	}
}

// -------------------------------------

void PutImageCKAD(long X, long Y, LPDWORD Image)
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

PutImage_CK_AD_LOOPY:

		MOV		ECX, PasteW

PutImage_CK_AD_LOOPX:

		LODSD
		CMP		EAX, CK_VALUE
		JZ		PutImage_CK_AD_LOOP_SKIP

		MOVD		MM1, [EDI]
		MOVD		MM0, EAX
		PADDUSB		MM0, MM1
		MOVD		EAX, MM0

		STOSD

		DEC		ECX
		JNZ		PutImage_CK_AD_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_AD_LOOPY
		EMMS
	}

	return;

PutImage_CK_AD_LOOP_SKIP:

	_asm {
		ADD		EDI, 4
		DEC		ECX
		JNZ		PutImage_CK_AD_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_AD_LOOPY
		EMMS
	}
}

// -------------------------------------

void PutImageCKSB(long X, long Y, LPDWORD Image)
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

PutImage_CK_SB_LOOPY:

		MOV		ECX, PasteW

PutImage_CK_SB_LOOPX:

		LODSD
		CMP		EAX, CK_VALUE
		JZ		PutImage_CK_SB_LOOP_SKIP

		MOVD		MM1, EAX
		MOVD		MM0, [EDI]
		PSUBUSB		MM0, MM1
		MOVD		EAX, MM0

		STOSD

		DEC		ECX
		JNZ		PutImage_CK_SB_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_SB_LOOPY
		EMMS
	}

	return;

PutImage_CK_SB_LOOP_SKIP:

	_asm {
		ADD		EDI, 4
		DEC		ECX
		JNZ		PutImage_CK_SB_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_SB_LOOPY
		EMMS
	}
}

// -------------------------------------

void PutImageCKAB(long X, long Y, LPDWORD Image, long Alpha)
{
	long	ImageW, ImageH;
	long	PasteW, PasteH;
	long	temp;

	if(Alpha <= 0)
	{
		return;
	}
	if(Alpha > 255)
	{
		PutImageCK(X, Y, Image);
		return;
	}

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

	for(temp = 0; temp < 4; temp ++)
	{
		ALPHA1[temp] = (WORD)Alpha;
		ALPHA2[temp] = (WORD)(256 - Alpha);
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

		MOVQ		MM3, [ALPHA1]		// MM3 = Alpha1		(64)
		MOVQ		MM4, [ALPHA2]		// MM4 = Alpha2		(64)		SUB		EDX, PasteW

PutImage_CK_AB_LOOPY:

		MOV		ECX, PasteW

PutImage_CK_AB_LOOPX:

		LODSD
		CMP		EAX, CK_VALUE
		JZ		PutImage_CK_AB_LOOP_SKIP


		MOVD		MM1, EAX			// MM1 = [ESI]		(32)
		MOVD		MM2, [EDI]			// MM2 = [EDI]		(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)
		PUNPCKLBW	MM2, MM0			// MM2				(16x4)

		PMULLW		MM1, MM3
		PMULLW		MM2, MM4

		PADDUSW		MM1, MM2
		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1

		STOSD

		DEC		ECX
		JNZ		PutImage_CK_AB_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_AB_LOOPY
		EMMS
	}

	return;

PutImage_CK_AB_LOOP_SKIP:

	_asm {
		ADD		EDI, 4
		DEC		ECX
		JNZ		PutImage_CK_AB_LOOPX

		ADD		ESI, EBX
		ADD		EDI, EDX
		DEC		PasteH
		JNZ		PutImage_CK_AB_LOOPY
		EMMS
	}
}

// -------------------------------------
//			Speacial Effect Function
// -------------------------------------

#define ClearSFXBuffer() ClearRenderBuffer(4)

// -------------------------------------
//	White Noise
// -------------------------------------

void WhiteNoise(void)
{
	long	i;
	
	for(i = 0; i < RENDER_WIDTH * RENDER_HEIGHT / 4; i ++)
	{
		RenderBuffer[i] = Brightness[rand()&0xff];
	}
	_asm {
		LEA		ESI, [RenderBuffer]
		LEA		EDI, [RenderBuffer + RENDER_WIDTH * RENDER_HEIGHT * 4 / 4]
		MOV		ECX, RENDER_WIDTH * RENDER_HEIGHT / 4
		REP		MOVSD
		LEA		ESI, [RenderBuffer]
		MOV		ECX, RENDER_WIDTH * RENDER_HEIGHT / 4
		REP		MOVSD
		LEA		ESI, [RenderBuffer]
		MOV		ECX, RENDER_WIDTH * RENDER_HEIGHT / 4
		REP		MOVSD
	}
}

// -------------------------------------
//	Ripple Effect
// -------------------------------------

short	*RippleBuffer1 = (short *)RenderBuffer + RENDER_HEIGHT * RENDER_WIDTH * 8,
		*RippleBuffer2 = (short *)RenderBuffer + RENDER_HEIGHT * RENDER_WIDTH * 9;

// -------------------------------------

void RippleSpread(void)
{
	long	Width, Height, LineAdd;

	Width = XMAX - XMIN - 1;
	Height = YMAX - YMIN - 1;
	LineAdd = (RENDER_WIDTH - Width) * 2;	// 2BYTE

	_asm {
		MOV		ESI, RippleBuffer1
		MOV		EDI, RippleBuffer2

		MOV		RippleBuffer2, ESI
		MOV		RippleBuffer1, EDI

		MOV		EAX, YMIN
		MOV		EBX, XMIN
		INC		EAX
		INC		EBX

		MOV		EAX, [LineStartOffset + EAX * 4]
		SHR		EAX, 1

		ADD		ESI, EAX
		ADD		EDI, EAX

		LEA		ESI, [ESI + EBX * 2]
		LEA		EDI, [EDI + EBX * 2]

		MOV		EDX, Height

RippleSpread_LoopY:

		MOV		ECX, Width

RippleSpread_LoopX:

		MOV		AX, [ESI - 2]					// [x-1]
		MOV		BX, [ESI + 2]					// [x+1]
		ADD		AX, [ESI - RENDER_WIDTH * 2]	// [y-1]
		ADD		BX, [ESI + RENDER_WIDTH * 2]	// [y+1]
		ADD		AX, BX
		SAR		AX, 1
		ADD		ESI, 2
		SUB		AX, [EDI]
		MOV		BX, AX
		SAR		BX, 7							// Ë¥¼õËÙ¶È
		SUB		AX, BX
		STOSW


		DEC		ECX
		JNZ		RippleSpread_LoopX

		ADD		ESI, LineAdd
		ADD		EDI, LineAdd
		DEC		EDX
		JNZ		RippleSpread_LoopY
	}
}

// -------------------------------------
/*
void RenderRippleAsm(void)
{
	long	Width, Height;
	long	x, y;

	Width = XMAX - XMIN - 1;
	Height = YMAX - YMIN - 1;

	y= YMIN + 1;

	_asm {

RenderRippleFast_LoopY:

		MOV		ESI, RippleBuffer1
		MOV		EAX, y
		MOV		EBX, XMIN
		MOV		EAX, [LineStartOffset + EAX * 4]
		INC		EBX
		MOV		EDX, EAX
		MOV		x, EBX
		SHR		EAX, 1
		ADD		ESI, EAX
		LEA		ESI, [ESI + EBX * 2]				// lpRipple
		LEA		EDI, [EDX + EBX * 4 + RenderBuffer]	// lpDst

		MOV		ECX, Width

RenderRippleFast_LoopX:

		MOV		AX, [ESI - 2]					// 
		SUB		AX, [ESI + 2]					// ax = xoff

		MOV		BX, [ESI - RENDER_WIDTH * 2]	// 
		SUB		BX, [ESI + RENDER_WIDTH * 2]	// bx = yoff

		MOVSX	EAX, AX
		MOVSX	EBX, BX
		ADD		EAX, x
		ADD		EBX, y

		CMP		EAX, XMIN
		JL		RenderRippleFast_Skip
		CMP		EAX, XMAX
		JG		RenderRippleFast_Skip

		CMP		EBX, YMIN
		JL		RenderRippleFast_Skip
		CMP		EBX, YMAX
		JG		RenderRippleFast_Skip

		MOV		EBX, [LineStartOffset + EBX * 4]
		LEA		EBX, [EBX + EAX * 4 + RenderBuffer + RENDER_WIDTH * RENDER_HEIGHT * 4 * 3]
		MOV		EAX, [EBX]				// lpSrc

		STOSD
		INC		x

		ADD		ESI, 2							// lpRipple ++
		DEC		ECX
		JNZ		RenderRippleFast_LoopX
		
		INC		y
		DEC		Height
		JNZ		RenderRippleFast_LoopY
	}

	return;

	_asm {

RenderRippleFast_Skip:

		MOV		EAX, [EDI + RENDER_WIDTH * RENDER_HEIGHT * 4 * 3]

		STOSD
		INC		x

		ADD		ESI, 2							// lpRipple ++
		DEC		ECX
		JNZ		RenderRippleFast_LoopX
		
		INC		y
		DEC		Height
		JNZ		RenderRippleFast_LoopY
	}
}
*/

// -------------------------------------

void RenderRipple(void)
{
	long	x, y, xoff, yoff;
	short	*lpRip;
	long	*lpDst;

	for(y=YMIN+1; y<YMAX; y++)
	{
		lpRip = RippleBuffer1 + y*RENDER_WIDTH + XMIN + 1;
		lpDst = (long *)RenderBuffer + MultipleWidth[y] + XMIN + 1;
		for(x=XMIN+1; x<XMAX; x++)
		{
			xoff = (*(lpRip-1)-*(lpRip+1))>>3;
			yoff = (*(lpRip-RENDER_WIDTH)-*(lpRip+RENDER_WIDTH))>>3;
			if(y+yoff<=YMAX && y+yoff>=YMIN && x+xoff<=XMAX && x+xoff>=XMIN)
			{
				*lpDst=*((long *)RenderBuffer + RENDER_HEIGHT * RENDER_WIDTH * 3 + MultipleWidth[y + yoff] + x + xoff);
			}
			else
			{
				*lpDst=*((long *)RenderBuffer + RENDER_HEIGHT * RENDER_WIDTH * 3 + MultipleWidth[y] + x);
			}
			lpRip ++;
			lpDst++;
		}
	}
}

// -------------------------------------

void AddRipple(int x, int y, int size, int weight)
{
	if ((x+size)>=XMAX || (y+size)>=YMAX || 
		(x-size)<XMIN || (y-size)<YMIN) return;

	for (int posx=x-size; posx<x+size; posx++)
	for (int posy=y-size; posy<y+size; posy++)
		if ((posx-x)*(posx-x) + (posy-y)*(posy-y) < size*size)
			RippleBuffer1[MultipleWidth[posy]+posx] = weight;
}
