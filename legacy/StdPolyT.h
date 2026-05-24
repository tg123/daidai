/*  StdPolyT.H  */

// -------------------------------------

long		PolygonTextureUL[RENDER_HEIGHT];
long		PolygonTextureUR[RENDER_HEIGHT];

long		PolygonTextureVL[RENDER_HEIGHT];
long		PolygonTextureVR[RENDER_HEIGHT];

long		PolyLineU1,		PolyLineV1;
long		PolyLineU2,		PolyLineV2;
long		PolyLineUa = 0, PolyLineVa = 0;

LPDWORD		lpTextureSource;
LPDWORD		lpNULL;		// NULL for align 8-byte

WORD		ALPHA1[4], ALPHA2[4];

// -------------------------------------
//	Load Texture
// -------------------------------------

void LoadTextureFile(LPDWORD DataBuffer, LPSTR filename)
{
	long		x, y, k = 0;
	DWORD		c, c2;
	FILE		*fp;

	fp = fopen(filename, "rb");
	fread(DataBuffer, 0x4000, 4, fp);
	fclose(fp);
/*
	// output as raw file
	{
		fp = fopen("123", "wb");
		for(long i=0;i<0x4000;i++)
			fwrite(DataBuffer+i, 1, 3, fp);
		fclose(fp);
	}
*/
	for(y=127; y>=0; y--)
	for(x=127; x>=0; x--)
	{
		c = *(DataBuffer+y*128+x);
		if(c == CK_VALUE)
		{	// Is ColorKey Texture
			k = 1;
			c = c | 0x80000000;			// Flag = 1000
		}
		*(DataBuffer+y*512+x*2) = c;
	}

	if(k == 0)
	{	// Normal Texture
		for(y=0; y<256; y+=2)
		for(x=0; x<256; x+=2)
			*(DataBuffer+y*256+x+1) = ((*(DataBuffer+y*256+x)&0xFEFEFE)+(*(DataBuffer+y*256+x+2)&0xFEFEFE))/2;

		for(y=0; y<255; y+=2)
		for(x=0; x<256; x++)
			*(DataBuffer+(y+1)*256+x) = ((*(DataBuffer+y*256+x)&0xFEFEFE)+(*(DataBuffer+(y+2)*256+x)&0xFEFEFE))/2;
	}
	else
	{	// ColorKey Texture
		for(y=0; y<256; y+=2)
		for(x=0; x<256; x+=2)
		{	// H-check
			c =	*(DataBuffer+y*256+x) & 0xFFFFFF;
			c2 = *(DataBuffer+y*256+x+2) & 0xFFFFFF;
			if(c == CK_VALUE || c2 == CK_VALUE)
			{
				if(c == CK_VALUE && c2 == CK_VALUE)
				{	// Flag = 1000
					*(DataBuffer+y*256+x+1) = CK_VALUE | 0x80000000;
				}
				else
				{	// Flag = 1010
					if(c == CK_VALUE) c = c2;
					*(DataBuffer+y*256+x+1) = (c & 0xFEFEFE) | 0xA0000000;
				}
			}
			else
			{
				*(DataBuffer+y*256+x+1) = ((c&0xFEFEFE)+(c2&0xFEFEFE))/2;
			}
		}

		for(y=0; y<255; y+=2)
		for(x=0; x<256; x+=2)
		{	// V-check
			c =	*(DataBuffer+y*256+x) & 0xFFFFFF;
			c2 = *(DataBuffer+(y+2)*256+x) & 0xFFFFFF;
			if(c == CK_VALUE || c2 == CK_VALUE)
			{
				if(c == CK_VALUE && c2 == CK_VALUE)
				{	// Flag = 1000
					*(DataBuffer+(y+1)*256+x) = CK_VALUE | 0x80000000;
				}
				else
				{	// Flag = 1010
					if(c == CK_VALUE) c = c2;
					*(DataBuffer+(y+1)*256+x) = (c & 0xFEFEFE) | 0xA0000000;
				}
			}
			else
			{
				*(DataBuffer+(y+1)*256+x) = ((c&0xFEFEFE)+(c2&0xFEFEFE))/2;
			}
		}

		for(y=0; y<255; y+=2)
		for(x=0; x<255; x+=2)
		{	// HV-check
			k = 0;
			c2 = 0;

			c =	*(DataBuffer+y*256+x) & 0xFFFFFF;
			if(c != CK_VALUE)
			{
				c2 += (c&0xFCFCFC);
				k++;
			}
			c =	*(DataBuffer+y*256+x+2) & 0xFFFFFF;
			if(c != CK_VALUE)
			{
				c2 += (c&0xFCFCFC);
				k++;
			}
			c =	*(DataBuffer+(y+2)*256+x+2) & 0xFFFFFF;
			if(c != CK_VALUE)
			{
				c2 += (c&0xFCFCFC);
				k++;
			}
			c =	*(DataBuffer+(y+2)*256+x) & 0xFFFFFF;
			if(c != CK_VALUE)
			{
				c2 += (c&0xFCFCFC);
				k++;
			}

			switch(k)
			{
				case 0:
					// Flag = 1000
					*(DataBuffer+(y+1)*256+x+1) = CK_VALUE | 0x80000000;
					break;
				case 1:
					// Flag = 1001
					*(DataBuffer+(y+1)*256+x+1) = c2 | 0x90000000;
					break;
				case 2:
					// Flag = 1010
					*(DataBuffer+(y+1)*256+x+1) = (c2 / 2) | 0xA0000000;
					break;
				case 3:
					// Flag = 1011
					*(DataBuffer+(y+1)*256+x+1) = c2 | 0xB0000000;
					break;
				case 4:
					*(DataBuffer+(y+1)*256+x+1) = c2 / 4;
					break;
			}
		}
	}
}

// -------------------------------------
//	Scan Edge
// -------------------------------------

void ScanEdgeUV(
		long X1, long Y1,
		long X2, long Y2,
		long U1, long V1, 
		long U2, long V2
	)
{
	long	deltax, deltay, halfx, halfy, dotn;
	long	x, y, dirx, diry, b;
	long	Ua;
	long	Va;

	if(Y1==Y2 && Y1>=YMIN && Y1<=YMAX)
	{
		if(X1<PolygonSideL[Y1])
		{
			PolygonSideL[Y1]=X1;
			PolygonTextureUL[Y1]=U1;
			PolygonTextureVL[Y1]=V1;
		}
		if(X1>PolygonSideR[Y1])
		{
			PolygonSideR[Y1]=X1;
			PolygonTextureUR[Y1]=U1;
			PolygonTextureVR[Y1]=V1;
		}
		if(X2<PolygonSideL[Y1])
		{
			PolygonSideL[Y1]=X2;
			PolygonTextureUL[Y1]=U2;
			PolygonTextureVL[Y1]=V2;
		}
		if(X2>PolygonSideR[Y1])
		{
			PolygonSideR[Y1]=X2;
			PolygonTextureUR[Y1]=U2;
			PolygonTextureVR[Y1]=V2;
		}
		return;
	}

	dirx=1;diry=1;
	if((deltax=X2-X1)<0)
	{
		deltax=-deltax;
		dirx=-1;
	}
	if((deltay=Y2-Y1)<0)
	{
		deltay=-deltay;
		diry=-1;
	}
	x=X1;y=Y1;b=0;
	if(deltax<deltay)
	{
		Ua=(U2-U1)/deltay;
		Va=(V2-V1)/deltay;
		halfy=deltay>>1;
		dotn=deltay;
		do
		{
			if(y>=YMIN && y<=YMAX)
			{
				if(x<PolygonSideL[y])
				{
					PolygonSideL[y]=x;
					PolygonTextureUL[y]=U1;
					PolygonTextureVL[y]=V1;
				}
			    if(x>PolygonSideR[y])
				{
					PolygonSideR[y]=x;
					PolygonTextureUR[y]=U1;
					PolygonTextureVR[y]=V1;
				}
			}
			y+=diry;
			b+=deltax;
			U1+=Ua;
			V1+=Va;
			if(b>halfy)
			{
				b-=deltay;
				x+=dirx;
			}
		} while(dotn--);
    }
	else
	{
		Ua=(U2-U1)/deltax;
		Va=(V2-V1)/deltax;
		halfx=deltax>>1;
		dotn=deltax;
		do
		{
			if(y>=YMIN && y<=YMAX)
			{
				if(x<PolygonSideL[y])
				{
					PolygonSideL[y]=x;
					PolygonTextureUL[y]=U1;
					PolygonTextureVL[y]=V1;
				}
			    if(x>PolygonSideR[y])
				{
					PolygonSideR[y]=x;
					PolygonTextureUR[y]=U1;
					PolygonTextureVR[y]=V1;
				}
			}
			x+=dirx;
			b+=deltay;
			U1+=Ua;
			V1+=Va;
			if(b>halfx)
			{
				b-=deltax;
				y+=diry;
			}
		}	while(dotn--);
	}
}

// -------------------------------------
//	Draw Texture HLine
// -------------------------------------

void HLineT(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]
		INC		ECX
		MOV		EDX, lpTextureSource

Texel_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		ADD		EBP, PolyLineUa
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBX, PolyLineVa
		MOV		EAX, [ESI+EAX]
		STOSD

		DEC		ECX
		JNZ		Texel_Loop
	}
}

// -------------------------------------

void HLineTAD(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_AD_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_AD_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_AD_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_AD_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_AD_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_AD_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]
		INC		ECX
		MOV		EDX, lpTextureSource

Texel_AD_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		ADD		EBP, PolyLineUa
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBX, PolyLineVa
		MOVD		MM1, [EDI]
		MOVD		MM0, [ESI+EAX]
		PADDUSB		MM0, MM1
		MOVD		EAX, MM0
		STOSD

		DEC		ECX
		JNZ		Texel_AD_Loop
		EMMS
	}
}

// -------------------------------------

void HLineTSB(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_SB_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_SB_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_SB_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_SB_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_SB_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_SB_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]
		INC		ECX
		MOV		EDX, lpTextureSource

Texel_SB_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		ADD		EBP, PolyLineUa
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBX, PolyLineVa
		MOVD		MM1, [EDI]
		MOVD		MM0, [ESI+EAX]
		PSUBUSB		MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_SB_Loop
		EMMS
	}
}

// -------------------------------------

void HLineTAB(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_AB_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_AB_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_AB_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_AB_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_AB_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_AB_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]

		MOVQ		MM3, [ALPHA1]		// MM3 = Alpha1		(64)
		MOVQ		MM4, [ALPHA2]		// MM4 = Alpha2		(64)

		INC		ECX
		MOV		EDX, lpTextureSource

Texel_AB_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		ADD		EBP, PolyLineUa
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBX, PolyLineVa

		MOVD		MM1, [ESI+EAX]		// MM1 = [ESI+EAX]	(32)
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
		JNZ		Texel_AB_Loop
		EMMS
	}
}

// -------------------------------------

void HLineTBR(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_BR_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_BR_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_BR_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_BR_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_BR_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_BR_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]

		MOVQ		MM3, [ALPHA1]		// MM3 = Alpha1		(64)

		INC		ECX
		MOV		EDX, lpTextureSource

Texel_BR_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		ADD		EBP, PolyLineUa
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBX, PolyLineVa

		MOVD		MM1, [ESI+EAX]		// MM1 = [ESI+EAX]	(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)

		PMULLW		MM1, MM3

		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1

		STOSD

		DEC		ECX
		JNZ		Texel_BR_Loop
		EMMS
	}
}

// -------------------------------------
//	Draw Colorkey Texture HLine
// -------------------------------------

void HLineTCK(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_CK_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_CK_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_CK_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_CK_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_CK_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_CK_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]
		INC		ECX

Texel_CK_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		MOV		EDX, lpTextureSource
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBP, PolyLineUa
		MOV		EAX, [ESI+EAX]
		ADD		EBX, PolyLineVa
		CMP		EAX, 0x80000000
		JAE		Texel_CK_Skip

		STOSD

		DEC		ECX
		JNZ		Texel_CK_Loop
	}

	return;

Texel_CK_Skip:

	_asm {
		CMP		EAX, CK_VALUE | 0x80000000
		JNZ		Texel_CK_K3

		ADD		EDI, 4

		DEC		ECX
		JNZ		Texel_CK_Loop
	}

	return;

Texel_CK_K3:

	_asm {
		CMP		EAX, 0xB0000000
		JB		Texel_CK_K2
		
		MOV		EDX, [EDI]
		AND		EDX, 0xFCFCFC
		ADD		EAX, EDX
		SHR		EAX, 2
		STOSD

		DEC		ECX
		JNZ		Texel_CK_Loop
	}

	return;

Texel_CK_K2:

	_asm {
		CMP		EAX, 0xA0000000
		JB		Texel_CK_K1

		MOV		EDX, [EDI]
		AND		EDX, 0xFEFEFE
		ADD		EAX, EDX
		SHR		EAX, 1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_Loop
	}

	return;

Texel_CK_K1:

	_asm {
		MOV		EDX, [EDI]
		AND		EDX, 0xFCFCFC
		LEA		EDX, [EDX+EDX*2]
		ADD		EAX, EDX
		SHR		EAX, 2
		STOSD

		DEC		ECX
		JNZ		Texel_CK_Loop
	}
}

// -------------------------------------

void HLineTCKAD(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_CK_AD_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_CK_AD_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_CK_AD_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_CK_AD_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_CK_AD_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_CK_AD_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]
		INC		ECX

Texel_CK_AD_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		MOV		EDX, lpTextureSource
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBP, PolyLineUa
		MOV		EAX, [ESI+EAX]
		ADD		EBX, PolyLineVa
		CMP		EAX, 0x80000000
		JAE		Texel_CK_AD_Skip

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PADDUSB		MM0, MM1
		MOVD		EAX, MM0
		STOSD

		DEC		ECX
		JNZ		Texel_CK_AD_Loop
		EMMS
	}

	return;

Texel_CK_AD_Skip:

	_asm {
		CMP		EAX, CK_VALUE | 0x80000000
		JNZ		Texel_CK_AD_K3

		ADD		EDI, 4

		DEC		ECX
		JNZ		Texel_CK_AD_Loop
		EMMS
	}

	return;

Texel_CK_AD_K3:

	_asm {
		CMP		EAX, 0xB0000000
		JB		Texel_CK_AD_K2

		SHR		EAX, 2

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PADDUSB		MM0, MM1
		MOVD		EAX, MM0
		STOSD

		DEC		ECX
		JNZ		Texel_CK_AD_Loop
		EMMS
	}

	return;

Texel_CK_AD_K2:

	_asm {
		CMP		EAX, 0xA0000000
		JB		Texel_CK_AD_K1

		SHR		EAX, 1

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PADDUSB		MM0, MM1
		MOVD		EAX, MM0
		STOSD

		DEC		ECX
		JNZ		Texel_CK_AD_Loop
		EMMS
	}

	return;

Texel_CK_AD_K1:

	_asm {
		SHR		EAX, 2

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PADDUSB		MM0, MM1
		MOVD		EAX, MM0

		STOSD

		DEC		ECX
		JNZ		Texel_CK_AD_Loop
		EMMS
	}
}

// -------------------------------------

void HLineTCKSB(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_CK_SB_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_CK_SB_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_CK_SB_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_CK_SB_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_CK_SB_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_CK_SB_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]
		INC		ECX

Texel_CK_SB_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		MOV		EDX, lpTextureSource
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBP, PolyLineUa
		MOV		EAX, [ESI+EAX]
		ADD		EBX, PolyLineVa
		CMP		EAX, 0x80000000
		JAE		Texel_CK_SB_Skip

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PSUBUSB		MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_SB_Loop
		EMMS
	}

	return;

Texel_CK_SB_Skip:

	_asm {
		CMP		EAX, CK_VALUE | 0x80000000
		JNZ		Texel_CK_SB_K3

		ADD		EDI, 4

		DEC		ECX
		JNZ		Texel_CK_SB_Loop
		EMMS
	}

	return;

Texel_CK_SB_K3:

	_asm {
		CMP		EAX, 0xB0000000
		JB		Texel_CK_SB_K2

		SHR		EAX, 2

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PSUBUSB		MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_SB_Loop
		EMMS
	}

	return;

Texel_CK_SB_K2:

	_asm {
		CMP		EAX, 0xA0000000
		JB		Texel_CK_SB_K1

		SHR		EAX, 1

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PSUBUSB		MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_SB_Loop
		EMMS
	}

	return;

Texel_CK_SB_K1:

	_asm {
		SHR		EAX, 2

		MOVD		MM0, EAX
		MOVD		MM1, [EDI]
		PSUBUSB		MM1, MM0
		MOVD		EAX, MM1

		STOSD

		DEC		ECX
		JNZ		Texel_CK_SB_Loop
		EMMS
	}
}

// -------------------------------------

void HLineTCKAB(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_CK_AB_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_CK_AB_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_CK_AB_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_CK_AB_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_CK_AB_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_CK_AB_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL

		MOVQ		MM3, [ALPHA1]		// MM3 = Alpha1		(64)
		MOVQ		MM4, [ALPHA2]		// MM4 = Alpha2		(64)

		INC		ECX
		LEA		EDI, [EDI + EAX * 4]

Texel_CK_AB_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		MOV		EDX, lpTextureSource
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBP, PolyLineUa
		MOV		EAX, [ESI+EAX]
		ADD		EBX, PolyLineVa
		CMP		EAX, 0x80000000
		JAE		Texel_CK_AB_Skip

		MOVD		MM1, EAX			// MM1 = EAX		(32)
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
		JNZ		Texel_CK_AB_Loop
		EMMS
	}

	return;

Texel_CK_AB_Skip:

	_asm {
		CMP		EAX, CK_VALUE | 0x80000000
		JNZ		Texel_CK_AB_K3

		ADD		EDI, 4

		DEC		ECX
		JNZ		Texel_CK_AB_Loop
		EMMS
	}

	return;

Texel_CK_AB_K3:

	_asm {
		CMP		EAX, 0xB0000000
		JB		Texel_CK_AB_K2

		MOV		EDX, [EDI]
		AND		EDX, 0xFCFCFC
		ADD		EAX, EDX
		SHR		EAX, 2

		MOVD		MM1, EAX			// MM1 = EAX		(32)
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
		JNZ		Texel_CK_AB_Loop
		EMMS
	}

	return;

Texel_CK_AB_K2:

	_asm {
		CMP		EAX, 0xA0000000
		JB		Texel_CK_AB_K1

		MOV		EDX, [EDI]
		AND		EDX, 0xFEFEFE
		ADD		EAX, EDX
		SHR		EAX, 1

		MOVD		MM1, EAX			// MM1 = EAX		(32)
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
		JNZ		Texel_CK_AB_Loop
		EMMS
	}

	return;

Texel_CK_AB_K1:

	_asm {
		MOV		EDX, [EDI]
		AND		EDX, 0xFCFCFC
		LEA		EDX, [EDX+EDX*2]
		ADD		EAX, EDX
		SHR		EAX, 2

		MOVD		MM1, EAX			// MM1 = EAX		(32)
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
		JNZ		Texel_CK_AB_Loop
		EMMS
	}
}

// -------------------------------------

void HLineTCKBR(void)
{
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ua, Va
		JZ		Texel_CK_BR_L_equal_R

		// Ua=(U2-U1)/DeltaX
		MOV		EAX, PolyLineU2
		SUB		EAX, PolyLineU1
		CDQ
		IDIV	ECX
		MOV		PolyLineUa, EAX

		// Va=(V2-V1)/DeltaX
		MOV		EAX, PolyLineV2
		SUB		EAX, PolyLineV1
		CDQ
		IDIV	ECX
		MOV		PolyLineVa, EAX

		// Offset correct
		ADD		PolyLineU1, 0x400000
		ADD		PolyLineV1, 0x400000

Texel_CK_BR_L_equal_R:

		MOV		EBP, PolyLineU1
		MOV		EAX, XMIN
		MOV		EBX, PolyLineV1
		CMP		EAX, PolyLineXL
		JLE		Texel_CK_BR_L1
		MOV		ESI, PolyLineXL		// ESI=XL		XMIN>XL
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, ESI			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, PolyLineUa
		IMUL	ESI
		ADD		EBP, EAX

		MOV		EAX, PolyLineVa
		IMUL	ESI
		ADD		EBX, EAX
						
Texel_CK_BR_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// EAX=XMAX-XR
		JGE		Texel_CK_BR_L2
		ADD		ECX, EAX			// EAX<0	ECX=ECX+EAX=ECX-|EAX|

Texel_CK_BR_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL

		MOVQ		MM3, [ALPHA1]		// MM3 = Alpha1		(64)

		INC		ECX
		LEA		EDI, [EDI + EAX * 4]

Texel_CK_BR_Loop:

		MOV		EAX, EBP
		MOV		ESI, EBX
		SHR		EAX, 23
		MOV		EDX, lpTextureSource
		SHR		ESI, 13
		LEA		EAX, [EDX+EAX*4]
		AND		SI, 0xFC00
		ADD		EBP, PolyLineUa
		MOV		EAX, [ESI+EAX]
		ADD		EBX, PolyLineVa
		CMP		EAX, 0x80000000
		JAE		Texel_CK_BR_Skip

		MOVD		MM1, EAX			// MM1 = EAX		(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)

		PMULLW		MM1, MM3

		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_BR_Loop
		EMMS
	}

	return;

Texel_CK_BR_Skip:

	_asm {
		CMP		EAX, CK_VALUE | 0x80000000
		JNZ		Texel_CK_BR_K3

		ADD		EDI, 4

		DEC		ECX
		JNZ		Texel_CK_BR_Loop
		EMMS
	}

	return;

Texel_CK_BR_K3:

	_asm {
		CMP		EAX, 0xB0000000
		JB		Texel_CK_BR_K2

		MOV		EDX, [EDI]
		AND		EDX, 0xFCFCFC
		ADD		EAX, EDX
		SHR		EAX, 2

		MOVD		MM1, EAX			// MM1 = EAX		(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)

		PMULLW		MM1, MM3

		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_BR_Loop
		EMMS
	}

	return;

Texel_CK_BR_K2:

	_asm {
		CMP		EAX, 0xA0000000
		JB		Texel_CK_BR_K1

		MOV		EDX, [EDI]
		AND		EDX, 0xFEFEFE
		ADD		EAX, EDX
		SHR		EAX, 1

		MOVD		MM1, EAX			// MM1 = EAX		(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)

		PMULLW		MM1, MM3

		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_BR_Loop
		EMMS
	}

	return;

Texel_CK_BR_K1:

	_asm {
		MOV		EDX, [EDI]
		AND		EDX, 0xFCFCFC
		LEA		EDX, [EDX+EDX*2]
		ADD		EAX, EDX
		SHR		EAX, 2

		MOVD		MM1, EAX			// MM1 = EAX		(32)

		PXOR		MM0, MM0			// MM0 = 0			(64)

		PUNPCKLBW	MM1, MM0			// MM1				(16x4)

		PMULLW		MM1, MM3

		PSRLW		MM1, 8

		PACKUSWB	MM1, MM0
		MOVD		EAX, MM1
		STOSD

		DEC		ECX
		JNZ		Texel_CK_BR_Loop
		EMMS
	}
}

// -------------------------------------
//	Draw Quadrangle
// -------------------------------------

void QuadT(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineT();
		}
	}
}

// -------------------------------------

void QuadTAD(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTAD();
		}
	}
}

// -------------------------------------

void QuadTSB(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTSB();
		}
	}
}

// -------------------------------------

void QuadTAB(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource,
		long	Alpha
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	if(Alpha < 0) Alpha = 0;
	if(Alpha > 255) Alpha = 255;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(Xmin = 0; Xmin < 4; Xmin ++)
	{
		ALPHA1[Xmin] = (WORD)Alpha;
		ALPHA2[Xmin] = (WORD)(256 - Alpha);
	}

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTAB();
		}
	}
}

// -------------------------------------

void QuadTBR(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource,
		long	Bright
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	if(Bright <= 0)
	{
		Quad(X1, Y1, X2, Y2, X3, Y3, X4, Y4, 0);
		return;
	}
	if(Bright > 255)
	{
		QuadT(X1, Y1, X2, Y2, X3, Y3, X4, Y4, U1, V1, U2, V2, U3, V3, U4, V4, TextureSource);
		return;
	}

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(Xmin = 0; Xmin < 4; Xmin ++)
	{
		ALPHA1[Xmin] = (WORD)Bright;
	}

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTBR();
		}
	}
}

// -------------------------------------

void QuadTCK(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTCK();
		}
	}
}

// -------------------------------------

void QuadTCKAD(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTCKAD();
		}
	}
}

// -------------------------------------

void QuadTCKSB(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTCKSB();
		}
	}
}

// -------------------------------------

void QuadTCKAB(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource,
		long	Alpha
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	if(Alpha < 0) Alpha = 0;
	if(Alpha > 255) Alpha = 255;

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(Xmin = 0; Xmin < 4; Xmin ++)
	{
		ALPHA1[Xmin] = (WORD)Alpha;
		ALPHA2[Xmin] = (WORD)(256 - Alpha);
	}

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTCKAB();
		}
	}
}

// -------------------------------------

void QuadTCKBR(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long U1, long V1,
		long U2, long V2,
		long U3, long V3,
		long U4, long V4,
		LPDWORD TextureSource,
		long	Bright
	)
{
	long	counter, Ymin, Ymax;
	long	Xmax, Xmin;

	if(Bright < 0)
	{
		Bright = 0;
	}
	if(Bright > 255)
	{
		QuadTCK(X1, Y1, X2, Y2, X3, Y3, X4, Y4, U1, V1, U2, V2, U3, V3, U4, V4, TextureSource);
		return;
	}

	Ymin=Y1;
	Ymax=Y1;
	if(Y2<Ymin) Ymin=Y2;
	if(Y2>Ymax) Ymax=Y2;
	if(Y3<Ymin) Ymin=Y3;
	if(Y3>Ymax) Ymax=Y3;
	if(Y4<Ymin) Ymin=Y4;
	if(Y4>Ymax) Ymax=Y4;
	if(Ymax<YMIN || Ymin>YMAX) return;
	if(Ymin<YMIN) Ymin=YMIN;
	if(Ymax>YMAX) Ymax=YMAX;

	Xmin=X1;
	Xmax=X1;
	if(X2<Xmin) Xmin=X2;
	if(X2>Xmax) Xmax=X2;
	if(X3<Xmin) Xmin=X3;
	if(X3>Xmax) Xmax=X3;
	if(X4<Xmin) Xmin=X4;
	if(X4>Xmax) Xmax=X4;
	if(Xmax<XMIN || Xmin>XMAX) return;

	for(counter=Ymin; counter<=Ymax; counter++)
	{
		PolygonSideL[counter]=1000000000;
		PolygonSideR[counter]=-1000000000;
	}

	U1=(U1<<24); U2=(U2<<24); U3=(U3<<24); U4=(U4<<24);
	V1=(V1<<24); V2=(V2<<24); V3=(V3<<24); V4=(V4<<24);

	ScanEdgeUV(X1,Y1,X2,Y2,U1,V1,U2,V2);
	ScanEdgeUV(X2,Y2,X3,Y3,U2,V2,U3,V3);
	ScanEdgeUV(X3,Y3,X4,Y4,U3,V3,U4,V4);
	ScanEdgeUV(X4,Y4,X1,Y1,U4,V4,U1,V1);
	
	lpTextureSource = TextureSource;

	for(Xmin = 0; Xmin < 4; Xmin ++)
	{
		ALPHA1[Xmin] = (WORD)Bright;
	}

	for(PolyLineY = Ymin; PolyLineY <= Ymax; PolyLineY ++)
	{
		PolyLineXL = PolygonSideL[PolyLineY];
		PolyLineXR = PolygonSideR[PolyLineY];

		if(PolyLineXL > XMAX || PolyLineXR < XMIN)
		{
			// Needn't draw it
		}
		else
		{
			PolyLineU1 = PolygonTextureUL[PolyLineY];
			PolyLineV1 = PolygonTextureVL[PolyLineY];
			PolyLineU2 = PolygonTextureUR[PolyLineY];
			PolyLineV2 = PolygonTextureVR[PolyLineY];
			HLineTCKBR();
		}
	}
}

