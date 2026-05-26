/*  StdPoly.H  */

long		PolygonSideL[RENDER_HEIGHT];
long		PolygonSideR[RENDER_HEIGHT];

long		PolygonRColorL[RENDER_HEIGHT];
long		PolygonRColorR[RENDER_HEIGHT];
long		PolygonGColorL[RENDER_HEIGHT];
long		PolygonGColorR[RENDER_HEIGHT];
long		PolygonBColorL[RENDER_HEIGHT];
long		PolygonBColorR[RENDER_HEIGHT];

long 		PolyRColorL, PolyGColorL, PolyBColorL;
long 		PolyRColorR, PolyGColorR, PolyBColorR;

long		PolyLineXL,		PolyLineXR;
long		PolyLineY,		PolyColor;

// -------------------------------------
//	Scan Edge
// -------------------------------------

void ScanEdge(long X1, long Y1, long X2, long Y2)
{
	long	deltax,deltay,halfx,halfy,dotn;
	long	x,y,dirx,diry,b;

	if(Y1==Y2 && Y1>=YMIN && Y1<=YMAX)
	{
		if(X1<PolygonSideL[Y1])
		{
			PolygonSideL[Y1]=X1;
		}
		if(X1>PolygonSideR[Y1])
		{
			PolygonSideR[Y1]=X1;
		}
		if(X2<PolygonSideL[Y1])
		{
			PolygonSideL[Y1]=X2;
		}
		if(X2>PolygonSideR[Y1])
		{
			PolygonSideR[Y1]=X2;
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
		halfy=deltay>>1;
		dotn=deltay;
		do
		{
			if(y>=YMIN && y<=YMAX)
			{
				if(x<PolygonSideL[y])
				{
					PolygonSideL[y]=x;
				}
			    if(x>PolygonSideR[y])
				{
					PolygonSideR[y]=x;
				}
			}
			y+=diry;
			b+=deltax;
			if(b>halfy)
			{
				b-=deltay;
				x+=dirx;
			}
		} while(dotn--);
    }
	else
	{
		halfx=deltax>>1;
		dotn=deltax;
		do
		{
			if(y>=YMIN && y<=YMAX)
			{
				if(x<PolygonSideL[y])
				{
					PolygonSideL[y]=x;
				}
			    if(x>PolygonSideR[y])
				{
					PolygonSideR[y]=x;
				}
			}
			x+=dirx;
			b+=deltay;
			if(b>halfx)
			{
				b-=deltax;
				y+=diry;
			}
		}	while(dotn--);
	}
}

// -------------------------------------

void ScanEdgeGouraud(long X1, long Y1, long X2, long Y2, long C1, long C2)
{
	long	deltax,deltay,halfx,halfy,dotn;
	long	x,y,dirx,diry,b;
	long	R1, G1, B1;			// 16.16
	long	R2, G2, B2;			// 16.16
	long	Ra, Ga, Ba;			// 16.16

	_asm {
		MOV		EBX, C1
		MOV		EAX, EBX
		MOV		EDX, EBX
		AND		EAX, 0x000000FF
		AND		EDX, 0x0000FF00
		SHL		EAX, 16
		AND		EBX, 0x00FF0000
		MOV		B1, EAX
		SHL		EDX, 8
		MOV		G1, EDX
		MOV		R1, EBX

		MOV		EBX, C2
		MOV		EAX, EBX
		MOV		EDX, EBX
		AND		EAX, 0x000000FF
		AND		EDX, 0x0000FF00
		SHL		EAX, 16
		AND		EBX, 0x00FF0000
		MOV		B2, EAX
		SHL		EDX, 8
		MOV		G2, EDX
		MOV		R2, EBX
	}

	if(Y1==Y2 && Y1>=YMIN && Y1<=YMAX)
	{
		if (X1<PolygonSideL[Y1])
		{
			PolygonSideL[Y1]=X1;
			PolygonRColorL[Y1]=R1;
			PolygonGColorL[Y1]=G1;
			PolygonBColorL[Y1]=B1;
		}
		if (X1>PolygonSideR[Y1])
		{
			PolygonSideR[Y1]=X1;
			PolygonRColorR[Y1]=R1;
			PolygonGColorR[Y1]=G1;
			PolygonBColorR[Y1]=B1;
		}
		if (X2<PolygonSideL[Y1])
		{
			PolygonSideL[Y1]=X2;
			PolygonRColorL[Y1]=R2;
			PolygonGColorL[Y1]=G2;
			PolygonBColorL[Y1]=B2;
		}
		if (X2>PolygonSideR[Y1])
		{
			PolygonSideR[Y1]=X2;
			PolygonRColorR[Y1]=R2;
			PolygonGColorR[Y1]=G2;
			PolygonBColorR[Y1]=B2;
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
		Ra=(R2-R1)/deltay;
		Ga=(G2-G1)/deltay;
		Ba=(B2-B1)/deltay;

		halfy=deltay>>1;
		dotn=deltay;
		do
		{
			if(y>=YMIN && y<=YMAX)
			{
				if(x<PolygonSideL[y])
				{
					PolygonSideL[y]=x;
					PolygonRColorL[y]=R1;
					PolygonGColorL[y]=G1;
					PolygonBColorL[y]=B1;
				}
			    if(x>PolygonSideR[y])
				{
					PolygonSideR[y]=x;
					PolygonRColorR[y]=R1;
					PolygonGColorR[y]=G1;
					PolygonBColorR[y]=B1;
				}
			}
			y+=diry;
			b+=deltax;
			R1+=Ra;
			G1+=Ga;
			B1+=Ba;
			if(b>halfy)
			{
				b-=deltay;
				x+=dirx;
			}
		} while(dotn--);
    }
	else
	{
		Ra=(R2-R1)/deltax;
		Ga=(G2-G1)/deltax;
		Ba=(B2-B1)/deltax;

		halfx=deltax>>1;
		dotn=deltax;
		do
		{
			if(y>=YMIN && y<=YMAX)
			{
				if(x<PolygonSideL[y])
				{
					PolygonSideL[y]=x;
					PolygonRColorL[y]=R1;
					PolygonGColorL[y]=G1;
					PolygonBColorL[y]=B1;
				}
			    if(x>PolygonSideR[y])
				{
					PolygonSideR[y]=x;
					PolygonRColorR[y]=R1;
					PolygonGColorR[y]=G1;
					PolygonBColorR[y]=B1;
				}
			}
			x+=dirx;
			b+=deltay;
			R1+=Ra;
			G1+=Ga;
			B1+=Ba;

			if(b>halfx)
			{
				b-=deltax;
				y+=diry;
			}
		} while(dotn--);
	}
}

// -------------------------------------
//	Draw HLine
// -------------------------------------

void HLine(void)
{
	_asm {
		MOV		EBX, PolyLineXL
		MOV		ECX, PolyLineXR
		
		//	if(XL<XMIN) XL=XMIN;
		CMP		EBX, XMIN
		JGE		HLine_R
		MOV		EBX, XMIN

HLine_R:
	
		//	if(XR>XMAX) XR=XMAX;
		CMP		ECX, XMAX
		JLE		HLine_Ready
		MOV		ECX, XMAX

HLine_Ready:

		SUB		ECX, EBX

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset+EAX*4]
		ADD		EDI, EAX

		INC		ECX

		LEA		EDI, [EDI+EBX*4]
		MOV		EAX, PolyColor

		REP		STOSD
	}
}

// -------------------------------------

void HLineGouraud(void)
{
	long	Ra, Ga, Ba;

	// DeltaX=XR-XL ... DeltaX->ecx
	_asm {
		MOV		ECX, PolyLineXR
		SUB		ECX, PolyLineXL

		// if(DeltaX!=0) then calc Ra, Ga, Ba
		JZ		HLine_Gouraud_L_equal_R

		// Ra=(R2-R1)/DeltaX;
		MOV		EAX, PolyRColorR
		SUB		EAX, PolyRColorL
		CDQ
		IDIV	ECX
		MOV		Ra, EAX
		// Ga=(G2-G1)/DeltaX;
		MOV		EAX, PolyGColorR
		SUB		EAX, PolyGColorL
		CDQ
		IDIV	ECX
		MOV		Ga, EAX
		// Ba=(B2-B1)/DeltaX;
		MOV		EAX, PolyBColorR
		SUB		EAX, PolyBColorL
		CDQ
		IDIV	ECX
		MOV		Ba, EAX
		// Offset correct
		ADD		PolyRColorL,0x8000
		ADD		PolyGColorL,0x8000
		ADD		PolyBColorL,0x8000

HLine_Gouraud_L_equal_R:	

		//	if(XL<XMIN) XL=XMIN;
		MOV		EAX, XMIN
		CMP		PolyLineXL, EAX
		JGE		HLINE_GOURAUD_L1

		MOV		EBX, PolyLineXL		// EBX=XL		XL<XMIN
		MOV		PolyLineXL, EAX		// XL=XMIN(EAX)
		SUB		EAX, EBX			// EAX=XMIN-XL
		SUB		ECX, EAX			// ECX=ECX-EAX=ECX-(XMIN-XL)
		MOV		ESI, EAX

		// Left Clip
		MOV		EAX, Ra
		IMUL	ESI
		ADD		PolyRColorL, EAX

		MOV		EAX, Ga
		IMUL	ESI
		ADD		PolyGColorL, EAX

		MOV		EAX, Ba
		IMUL	ESI
		ADD		PolyBColorL, EAX

HLine_Gouraud_L1:

		//	if(XR>XMAX) XR=XMAX;
		MOV		EAX, XMAX
		SUB		EAX, PolyLineXR		// eax=XMAX-XR
		JGE		HLine_Gouraud_L2
		ADD		ECX, EAX			// eax<0	ecx=ecx+eax=ecx-|eax|

HLine_Gouraud_L2:

		MOV		EAX, PolyLineY
		MOV		EDI, lpRenderBuffer
		MOV		EAX, [LineStartOffset + EAX * 4]
		ADD		EDI, EAX
		MOV		EAX, PolyLineXL
		LEA		EDI, [EDI + EAX * 4]

		INC		ECX

		MOV		EDX, PolyBColorL
		MOV		ESI, PolyGColorL
//		MOV		ESI, PolyRColorL


HLine_Gouraud_Loop:

		MOV		EAX, EDX
		SHR		EAX, 16
		MOV		EBX, EAX

		MOV		EAX, ESI
		SHR		EAX, 8
		MOV		BH, AH

		MOV		EAX, PolyRColorL
		MOV		AX, BX
		STOSD
	
		MOV		EBX, PolyRColorL
		ADD		EDX, Ba
		ADD		EBX, Ra
		ADD		ESI, Ga
		MOV		PolyRColorL, EBX

		DEC		ECX
		JNZ		HLine_Gouraud_Loop
	}
}

// -------------------------------------
//	Draw Quadrangle
// -------------------------------------

void Quad(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		DWORD Color
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

	ScanEdge(X1,Y1,X2,Y2);
	ScanEdge(X2,Y2,X3,Y3);
	ScanEdge(X3,Y3,X4,Y4);
	ScanEdge(X4,Y4,X1,Y1);

	PolyColor = Color;

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
			HLine();
		}
	}
}

// -------------------------------------

void QuadGouraud(
		long X1, long Y1,
		long X2, long Y2,
		long X3, long Y3,
		long X4, long Y4,
		long C1, long C2, long C3, long C4
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

	ScanEdgeGouraud(X1,Y1,X2,Y2,C1,C2);
	ScanEdgeGouraud(X2,Y2,X3,Y3,C2,C3);
	ScanEdgeGouraud(X3,Y3,X4,Y4,C3,C4);
	ScanEdgeGouraud(X4,Y4,X1,Y1,C4,C1);

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
	 		PolyRColorL = PolygonRColorL[PolyLineY];
 			PolyGColorL = PolygonGColorL[PolyLineY];
 			PolyBColorL = PolygonBColorL[PolyLineY];
 			PolyRColorR = PolygonRColorR[PolyLineY];
 			PolyGColorR = PolygonGColorR[PolyLineY];
 			PolyBColorR = PolygonBColorR[PolyLineY];

			HLineGouraud();
		}
	}
}

// -------------------------------------

