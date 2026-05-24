/*

		               DaiDai Source Code
		               ==================

            COPYRIGHT(C)FAN YIPENG(樊一鹏), 1999-2000

                     http://freemind.163.net

[FILE]
    Version		:	1.0.04
	Relese Date :	99-12-05

	因为时间匆忙，所以没加注释，还请多理解。

	void InitGame(void) 游戏初始化
	void GameLoop(void) 游戏主体
	void ExitGame(void) 退出处理

	至于调用到的函数大家凭名字就能知道是干什么的了。

	用 "_" 开头的图形函数未做裁剪，大家使用时务必小心。
	实在吃不准就用没有 "_" 开头的那套图形函数吧。

	另外，游戏所需的其它资源都在以前发放的 worm1004.exe 游戏包中的 DAT 目录下。

	如果有什么问题，请去我主页上的论坛留言，我会定期去那里回答大家的问题。

	如果觉得我作得不好，愿意指点一二的，亦非常欢迎，先谢了：）

	愿大家能把国产游戏做得更好！
*/

/*--------------------------------------*/

char	ExePath[256];

/*--------------------------------------*/

#include "STDINIT.H"

/*--------------------------------------*/

long	Score, HiScore = 0;

#include <winreg.h>
#include <direct.h>

char	CRstr[]="(C)FAN YIPENG(樊一鹏)";
char	HPstr[]="HTTP://GAMEVISION.YEAH.NET";
char	VRstr[]="1.0.04";

void Regedit(void)
{
	char	WinExe[256];
	char	*pbuf;
	int		i;
	HKEY	hkey;

	pbuf = GetCommandLine();

	strcpy(WinExe, pbuf + 1);
	for(i = (int)strlen(WinExe); i >= 0; i --)
	{
		if(WinExe[i] == '"')
		{
			WinExe[i] = 0;
			i = -10000;
		}
	}

	// get running path
	strcpy(ExePath, WinExe);
	for(i = (int)strlen(WinExe); i >= 0; i --)
	{
		if(WinExe[i] == '\\')
		{
			ExePath[i+1] = 0;
			i = -10000;
		}
	}

	RegCreateKey(HKEY_USERS, ".DEFAULT\\Software\\GAMEVISION\\DAIDAI WORM",	&hkey);
	RegSetValueEx(hkey,	"COPYRIGHT", 0, REG_SZ, (BYTE *)CRstr, strlen(CRstr)+1);
	RegSetValueEx(hkey,	"HOMEPAGE",	0, REG_SZ, (BYTE *)HPstr, strlen(HPstr)+1);
	RegSetValueEx(hkey,	"VERSION", 0, REG_SZ, (BYTE *)VRstr, strlen(VRstr)+1);
	RegSetValueEx(hkey,	"PATH", 0, REG_SZ, (BYTE *)ExePath, strlen(ExePath)+1);
	RegSetValueEx(hkey,	"COMMAND", 0, REG_SZ, (BYTE *)WinExe, strlen(WinExe)+1);
	RegCloseKey(hkey);


	if(ExePath[0] >= 'a' && ExePath[0] <= 'z') ExePath[0] = ExePath[0] - 'a' + 'A';
	_chdrive(ExePath[0] - 'A' + 1);
	_chdir(ExePath);
}

void LoadScore(void)
{
	DWORD	Type, Size = 4;
	HKEY	hkey;

	RegCreateKey(HKEY_USERS, ".DEFAULT\\Software\\GAMEVISION\\DAIDAI WORM",	&hkey);
	RegQueryValueEx(hkey, "HISCORE", NULL, &Type, (BYTE *)&HiScore, &Size);
	RegCloseKey(hkey);
}

void SaveScore(void)
{
	HKEY	hkey;

	RegCreateKey(HKEY_USERS, ".DEFAULT\\Software\\GAMEVISION\\DAIDAI WORM",	&hkey);
	RegSetValueEx(hkey,	"HISCORE", 0, REG_DWORD, (BYTE *)&HiScore, 4);
	RegCloseKey(hkey);
}

/*--------------------------------------*/

DWORD	FOODTXM[0x10000];
DWORD	BRIGHTTXM[0x10000];

DWORD PicBack[400 * 300 + 2];

LPDWORD PicMouse;

LPDWORD PicWormBody;
LPDWORD PicWormBox;
LPDWORD PicWormShadow;

LPDWORD PicWormB[8];
LPDWORD PicWormD[8];

LPDWORD PicTitle;
LPDWORD PicTitle2;

LPDWORD PicHelpInfo;

LPDWORD PicAdd5;
LPDWORD PicAdd10;
LPDWORD PicAdd15;
LPDWORD PicAdd30;

LPDWORD PicScore;

// -------------------------------------

long	BG_CNT = 0;

// -------------------------------------

void LoadBG(void)
{
	LPDWORD		temp;

	temp = lpRenderBuffer;

	LoadVideoFrame(BG_CNT);
	SetRenderPage(SFX2PAGE);
	FilpWholeVideoBuffer();

	_GetImage(0, 0, 400, 300, PicBack);

	lpRenderBuffer = temp;
}

// -------------------------------------

void InitGame(void)
{
	Regedit();

AVIFileInit(); 

	if(OpenVideoStream("DAT\\bg.avi") == FALSE)
//	if(OpenVideoFile("DAT\\bg.avi") == FALSE)
	{
		InitFail("[BG.AVI] Load Fail");
		return;
	}

	LoadBG();

	LoadTextureFile(FOODTXM, "DAT\\food.txm");
	LoadTextureFile(BRIGHTTXM, "DAT\\bright.txm");

	PicTitle = LoadPPMImageFile("DAT\\title.ppm");
	PicTitle2 = LoadPPMImageFile("DAT\\titleb.ppm");

	PicHelpInfo = LoadPPMImageFile("DAT\\helpinfo.ppm");

	PicWormBody = LoadPPMImageFile("DAT\\wormbody.ppm");
	PicWormBox = LoadPPMImageFile("DAT\\wormbox.ppm");
	PicWormShadow = LoadPPMImageFile("DAT\\wormshadow.ppm");

	PicWormB[0] = LoadPPMImageFile("DAT\\wormb1.ppm");
	PicWormB[1] = LoadPPMImageFile("DAT\\wormb2.ppm");
	PicWormB[2] = LoadPPMImageFile("DAT\\wormb3.ppm");
	PicWormB[3] = LoadPPMImageFile("DAT\\wormb4.ppm");
	PicWormB[4] = LoadPPMImageFile("DAT\\wormb5.ppm");
	PicWormB[5] = LoadPPMImageFile("DAT\\wormb6.ppm");
	PicWormB[6] = LoadPPMImageFile("DAT\\wormb7.ppm");
	PicWormB[7] = LoadPPMImageFile("DAT\\wormb8.ppm");

	PicWormD[0] = LoadPPMImageFile("DAT\\wormd1.ppm");
	PicWormD[1] = LoadPPMImageFile("DAT\\wormd2.ppm");
	PicWormD[2] = LoadPPMImageFile("DAT\\wormd3.ppm");
	PicWormD[3] = LoadPPMImageFile("DAT\\wormd4.ppm");
	PicWormD[4] = LoadPPMImageFile("DAT\\wormd5.ppm");
	PicWormD[5] = LoadPPMImageFile("DAT\\wormd6.ppm");
	PicWormD[6] = LoadPPMImageFile("DAT\\wormd7.ppm");
	PicWormD[7] = LoadPPMImageFile("DAT\\wormd8.ppm");

	PicAdd5 = LoadPPMImageFile("DAT\\add5.ppm");
	PicAdd10 = LoadPPMImageFile("DAT\\add10.ppm");
	PicAdd15 = LoadPPMImageFile("DAT\\add15.ppm");
	PicAdd30 = LoadPPMImageFile("DAT\\add30.ppm");

	PicScore = LoadPPMImageFile("DAT\\score.ppm");

	PicMouse = LoadPPMImageFile("DAT\\mouse.ppm");
	SetMouseImage(PicMouse);
//	MouseOn();

	LoadRawSndData(0, "DAT\\LOOP.PCM", 1, 11025, 16);

	LoadRawSndData(1, "DAT\\DROP.PCM", 1, 11025, 16);

	LoadRawSndData(2, "DAT\\EAT.PCM", 1, 11025, 16);

	LoadRawSndData(3, "DAT\\FREEZE.PCM", 1, 22050, 16);

	LoadRawSndData(4, "DAT\\POPO.PCM", 1, 11025, 16);
	LoadRawSndData(5, "DAT\\DIE.PCM", 1, 11025, 16);

	LoadRawSndData(6, "DAT\\THUNDER1.PCM", 1, 11025, 16);
	LoadRawSndData(7, "DAT\\RAINLOOP.PCM", 2, 11025, 16);
	LoadRawSndData(8, "DAT\\THUNDER2.PCM", 1, 11025, 16);

	LoadRawSndData(10, "DAT\\BEAT.PCM", 1, 11025, 16);

	LoadRawSndData(11, "DAT\\FADE.PCM", 1, 11025, 16);

	LoadRawSndData(12, "DAT\\LASER.PCM", 1, 22050, 16);
	LoadRawSndData(13, "DAT\\WARP.PCM", 1, 22050, 16);

	LoadRawSndData(21, "DAT\\SPEEDUP.PCM", 1, 11025, 16);
	LoadRawSndData(22, "DAT\\SPEEDOWN.PCM", 1, 11025, 16);

	LoadRawSndData(90, "DAT\\MUSIC.PCM", 1, 22050, 8);
	LoadRawSndData(91, "DAT\\START.PCM", 1, 22050, 16);
	LoadRawSndData(92, "DAT\\SELECT.PCM", 1, 11025, 16);

	LoadRawSndData(101, "DAT\\ENV1.PCM", 1, 11025, 16);
	LoadRawSndData(102, "DAT\\ENV2.PCM", 1, 11025, 16);
	LoadRawSndData(103, "DAT\\ENV3.PCM", 1, 11025, 16);
	LoadRawSndData(104, "DAT\\ENV4.PCM", 1, 11025, 16);
	LoadRawSndData(105, "DAT\\ENV5.PCM", 1, 11025, 16);
	LoadRawSndData(106, "DAT\\ENV6.PCM", 1, 11025, 16);
	LoadRawSndData(107, "DAT\\ENV7.PCM", 1, 11025, 16);
	LoadRawSndData(108, "DAT\\ENV8.PCM", 1, 11025, 16);
	LoadRawSndData(109, "DAT\\ENV9.PCM", 1, 11025, 16);
	LoadRawSndData(110, "DAT\\ENV10.PCM", 1, 11025, 16);
	LoadRawSndData(111, "DAT\\ENV11.PCM", 1, 11025, 16);
	LoadRawSndData(112, "DAT\\ENV12.PCM", 1, 11025, 16);
	LoadRawSndData(113, "DAT\\ENV13.PCM", 1, 11025, 16);
	LoadRawSndData(114, "DAT\\ENV14.PCM", 1, 11025, 16);

	LoadScore();
}

// -------------------------------------

void ExitGame(void)
{
	int i;

	for(i=0;i<8;i++)
	{
		ClosePicFile(PicWormB[i]);
		ClosePicFile(PicWormD[i]);
	}

	ClosePicFile(PicTitle2);
	ClosePicFile(PicTitle);
	ClosePicFile(PicHelpInfo);

	ClosePicFile(PicAdd5);
	ClosePicFile(PicAdd10);
	ClosePicFile(PicAdd15);
	ClosePicFile(PicAdd30);

	ClosePicFile(PicScore);

	ClosePicFile(PicWormShadow);
	ClosePicFile(PicWormBox);
	ClosePicFile(PicWormBody);
	ClosePicFile(PicMouse);

	CloseVideoFile();
}

// -------------------------------------

long	GameStatus = -1;
//long	GameStatus = 0;
long	SceneBright = 0;

long	DayTime = 0;
long	MoonFull = 1;
long	RainTime = 0;

long	GoldenLightTime = 0, GoldenLightDirect = 0;
long	GoldenLightX, GoldenLightY, GoldenLightDX, GoldenLightDY;

// -------------------------------------

long	FramePassTime = 0;

// -------------------------------------

long	WaterSoundVolume = 0;
long	RainSoundVolume = 0;

// -------------------------------------

#define MAXWORMLEN	256
#define WORMSIZE	10

long	WormX[MAXWORMLEN], WormY[MAXWORMLEN];
long	WormD[MAXWORMLEN], WormLife[MAXWORMLEN];

BYTE	FoodXY[RENDER_WIDTH / WORMSIZE][RENDER_HEIGHT / WORMSIZE];
BYTE	EfctXY[RENDER_WIDTH / WORMSIZE][RENDER_HEIGHT / WORMSIZE];

short	FoodZ[RENDER_WIDTH / WORMSIZE][RENDER_HEIGHT / WORMSIZE];
short	EfctZ[RENDER_WIDTH / WORMSIZE][RENDER_HEIGHT / WORMSIZE];

BYTE	SearchX[2048];
BYTE	SearchY[2048];
long	SearchStart = 0, SearchEnd = 0;

long	WormLength = 0;
long	WormHoldCounter = 0;

long	WormSpeed = 2;
long	WormSpeedTime = 0;

long	WormStartCounter;
long	WormDieCounter;
long	WormEyeStatus = 0;

long	GameTime1, GameTime2;

long	EatTime = 0, EatColor; 

long	FoodCounter;

// -------------------------------------
//
// -------------------------------------

void GoldenLight(void)
{
	long	dx, dy, a;
	long	x1, x2, x3, x4, y1, y2, y3, y4;

	if(GoldenLightTime == 0) return;

	if(GoldenLightDX == 0 && GoldenLightDY == 0)
	{
		GoldenLightTime +=2;
	}

	if(GoldenLightTime > 50) GoldenLightTime = 0;

	GoldenLightX += GoldenLightDX;
	GoldenLightY += GoldenLightDY;

	if(GoldenLightX < 0 || GoldenLightX >= RENDER_WIDTH ||
	   GoldenLightY < 0 || GoldenLightY >= RENDER_HEIGHT)
	{
		GoldenLightTime = 0;
		return;
	}
	
	a = FoodXY[GoldenLightX / WORMSIZE][GoldenLightY / WORMSIZE];
	if(a == 0xFE || a < 5)
	{
		FoodXY[GoldenLightX / WORMSIZE][GoldenLightY / WORMSIZE] = 5;
		GoldenLightDX = 0;
		GoldenLightDY = 0;
		if(lpSoundData[13])
		{
			lpSoundData[13]->Stop();
			lpSoundData[13]->SetPan((GoldenLightX-200)*5);
			lpSoundData[13]->SetCurrentPosition(0);
			lpSoundData[13]->Play(NULL, NULL, 0);
		}
	}

	dx = GoldenLightX + 4;
	dy = GoldenLightY + 4;

	a = GoldenLightTime + 10;

	x1 = -a; y1 = -a;
	x2 = a; y2 = -a;
	x3 = a; y3 = a;
	x4 = -a; y4 = a;

	GoldenLightDirect += 64;
	if(GoldenLightDirect > 255) GoldenLightDirect -= 256;
	RotatePoint(&x1, &y1, (BYTE)GoldenLightDirect);
	RotatePoint(&x2, &y2, (BYTE)GoldenLightDirect);
	RotatePoint(&x3, &y3, (BYTE)GoldenLightDirect);
	RotatePoint(&x4, &y4, (BYTE)GoldenLightDirect);
	QuadTCKAD(dx+x1,dy+y1,dx+x2,dy+y2,dx+x3,dy+y3,dx+x4,dy+y4,
			  0,64,63,64,63,127,0,127,BRIGHTTXM);
}

// -------------------------------------

void PutInFood(int Color)
{
	long	dx, dy;
	long	foodx, foody;
	long	cnt = 0;

food_loop:

	foodx = rand() % (RENDER_WIDTH / WORMSIZE);
	foody = rand() % (RENDER_HEIGHT / WORMSIZE);

	cnt++;

	if(cnt > 1000) return;

	dx = WormX[0] / WORMSIZE;
	dy = WormY[0] / WORMSIZE;

	if(FoodXY[foodx][foody] != 0xFF) goto food_loop;

	if(abs(foodx-dx)<5 || abs(foody-dy)<5) goto food_loop;

	FoodXY[foodx][foody] = Color;
	FoodZ[foodx][foody] = 63;
}

// -------------------------------------

void BeanChange(void)
{
	long	i, j, cnt;
	long	x, y;

	cnt = SearchEnd - SearchStart;
	if(cnt < 0) cnt += (RENDER_WIDTH / WORMSIZE) * (RENDER_HEIGHT / WORMSIZE);

	if(rand() & 0x01 && cnt >= 9)
	{
		for(i = 0; i < 5; i ++)
		{
			j = SearchStart + (i << 1);
			if(j >= 2048) j = 0;

			x = SearchX[j];
			y = SearchY[j];

			EfctXY[x][y] = rand()%5;//(BYTE)i;
			EfctZ[x][y] = 0;

			if(i == 0)
			{
				if(lpSoundData[11])
				{
					lpSoundData[11]->Stop();
					lpSoundData[11]->SetPan((x-20)*50);
					lpSoundData[11]->SetCurrentPosition(0);
					lpSoundData[11]->Play(NULL, NULL, 0);
				}
			}
		}
		for(i = 0; i < 5; i ++)
		{
			SearchX[(SearchStart + 8 - i) & 0x7FF] = SearchX[(SearchStart + 7 - i * 2) & 0x7FF];
			SearchY[(SearchStart + 8 - i) & 0x7FF] = SearchY[(SearchStart + 7 - i * 2) & 0x7FF];
		}

		SearchStart += 5;
		if(SearchStart >= 2048)	SearchStart = 0;
	}
	else
	{
		if(cnt > 5) cnt = 5;

		for(i = 0; i < cnt; i ++)
		{
			x = SearchX[SearchStart];
			y = SearchY[SearchStart];
		
			SearchStart ++;
			if(SearchStart >= 2048)	SearchStart = 0;

			EfctXY[x][y] = rand()%5;//(BYTE)i;
			EfctZ[x][y] = 0;

			if(i == 0)
			{
				if(lpSoundData[11])
				{
					lpSoundData[11]->Stop();
					lpSoundData[11]->SetPan((x-20)*50);
					lpSoundData[11]->SetCurrentPosition(0);
					lpSoundData[11]->Play(NULL, NULL, 0);
				}
			}
		}
	}
}

// -------------------------------------

void WormDie(void)
{
	WormDieCounter = 0;

	GameStatus = 2;

	if(HiScore < Score)
	{
		HiScore = Score;
		SaveScore();
	}

	WormEyeStatus = 6;
	
	FramePassTime = 350;

	// die sound
	WormHoldCounter = 31;
	if(lpSoundData[5])
	{
		lpSoundData[5]->SetPan((WormX[0]-200)*5);
		lpSoundData[5]->Play(NULL, NULL, 0);
	}

	// stop heart beat sound
	if(lpSoundData[10])
	{
		lpSoundData[10]->Stop();
		lpSoundData[10]->SetCurrentPosition(0);
	}
}

// -------------------------------------

void CheckWormLength(void)
{
	long	i, x, y;

	if(WormLength == 24)
	{
		if(lpSoundData[10])
		{
			lpSoundData[10]->SetPan((WormX[0]-200)*5);
			lpSoundData[10]->Play(NULL, NULL, 1);
		}
	}

	if(WormLength >= 25)
	{
		if(lpSoundData[10])
		{
			lpSoundData[10]->Stop();
			lpSoundData[10]->SetCurrentPosition(0);
		}

		if(lpSoundData[3])
		{
			lpSoundData[3]->SetPan((WormX[5]-200)*5);
			lpSoundData[3]->Play(NULL, NULL, 0);
		}

		if(WormHoldCounter <= 0)
		{
			for(i = 5; i < WormLength; i ++)
			{
				x = WormX[i] / WORMSIZE;
				y = WormY[i] / WORMSIZE;

				FoodXY[x][y] = 0xFE;

				SearchX[SearchEnd] = (BYTE)x;
				SearchY[SearchEnd] = (BYTE)y;

				SearchEnd ++;
				if(SearchEnd >= 2048)
					SearchEnd = 0;
			}
			WormLength = 5;
			WormHoldCounter = 0;
		}
	}
}

// -------------------------------------

void WormGrowth(void)
{
	WormHoldCounter = WORMSIZE / WormSpeed;

	WormX[WormLength] = WormX[WormLength - 1];
	WormY[WormLength] = WormY[WormLength - 1];

	WormLength++;
}

// -------------------------------------

void WormThin(void)
{
	int		i, len;

	len = (WormLength) >> 1;

	for(i = len; i < WormLength; i ++)
	{
		FoodXY[WormX[i] / WORMSIZE][WormY[i] / WORMSIZE] = 0xFF;
		EfctZ[WormX[i] / WORMSIZE][WormY[i] / WORMSIZE] = (i - len) << 1;
		EfctXY[WormX[i] / WORMSIZE][WormY[i] / WORMSIZE] = 201;
	}

	WormLength = len;
	if(lpSoundData[10])
	{
		lpSoundData[10]->Stop();
		lpSoundData[10]->SetCurrentPosition(0);
	}
}

// -------------------------------------

void WormMoveStep(void)
{
	long	i, j;

	if(WormSpeedTime < 0)
	{
		AddRipple(WormX[0]+4, WormY[0]+5, 2, 10 * WormSpeedTime - (rand() & 0x1F));
		WormSpeedTime ++;
		if(lpSoundData[22])
		{
    		lpSoundData[22]->SetPan((WormX[0]-200)*5);
        }
		if(WormSpeedTime == 0)
		{
			WormSpeed = 2;
		}
	}
	else
	if(WormSpeedTime > 0)
	{
		AddRipple(WormX[1]+4, WormY[1]+5, 3, 20 * (40 - WormSpeedTime) + (rand() & 0x1F));
		WormSpeedTime --;
		if(lpSoundData[21])
		{
    		lpSoundData[21]->SetPan((WormX[0]-200)*5);
        }
		if(WormSpeedTime == 0)
		{
			WormSpeed = 5;
		}
	}

	// eat food
	if(WormX[0] % WORMSIZE == 0 && WormY[0] % WORMSIZE == 0)
	{
		i = FoodXY[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE];

		if(WormSpeedTime > 0 || (WormSpeed > 2 && WormSpeedTime >= 0))
		{
			if(i == 0)
			{
				WormSpeedTime = - 32;

				if(lpSoundData[22])
				{
					lpSoundData[21]->Stop();
					lpSoundData[22]->Stop();
					lpSoundData[22]->SetPan((WormX[0]-200)*5);
					lpSoundData[22]->SetCurrentPosition(0);
					lpSoundData[22]->Play(NULL, NULL, 0);
				}
			}
		}

		if(i == 5)
		{
			Score += 30;
			EfctXY[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 30;
			EfctZ[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 0;

			if(lpSoundData[2])
			{
				lpSoundData[2]->Stop();
				lpSoundData[2]->SetPan((WormX[0]-200)*5);
				lpSoundData[2]->SetCurrentPosition(0);
				lpSoundData[2]->Play(NULL, NULL, 0);
			}

			PutInFood(rand()%5);
		}

		if(i < 5)
		{
			Score += 5;

			if(WormSpeed > 2)
			{
				Score += 5;
				EfctXY[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 10;
				EfctZ[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 0;
			}

			if(EatTime < 1)
			{
				EatColor = i;
				EatTime = 1;
			}
			else
			{
				if(i == EatColor)
				{
					EatTime ++;
					if(EatTime >= 5)
//					if(EatTime >= 1)
					{
						EatTime = 0;
						switch(EatColor)
						{
							case 0:
								WormSpeedTime = 40;

								if(lpSoundData[21])
								{
									lpSoundData[21]->Stop();
									lpSoundData[21]->SetPan((WormX[0]-200)*5);
									lpSoundData[21]->SetCurrentPosition(0);
									lpSoundData[21]->Play(NULL, NULL, 0);
								}
								break;

							case 1:
								GoldenLightTime = 1;
								GoldenLightDirect = 0;
								
								GoldenLightX = WormX[0];
								GoldenLightY = WormY[0];
								
								GoldenLightDX = 0;
								GoldenLightDY = 0;

								switch(WormD[0])
								{
									case 0:
										GoldenLightDY = -10;
										break;
									case 1:
										GoldenLightDX = 10;
										break;
									case 2:
										GoldenLightDY = 10;
										break;
									case 3:
										GoldenLightDX = -10;
										break;
								}

								if(lpSoundData[12])
								{
									lpSoundData[12]->Stop();
									lpSoundData[12]->SetPan((WormX[0]-200)*5);
									lpSoundData[12]->SetCurrentPosition(0);
									lpSoundData[12]->Play(NULL, NULL, 0);
								}

								break;

							case 2:
								BeanChange();
								break;

							case 3:
								RainTime = 500;
								break;

							case 4:
								WormThin();
								break;
						}
					}
				}
				else
				{
					EatColor = i;
					EatTime = 1;
				}
			}

			if(lpSoundData[2])
			{
				lpSoundData[2]->Stop();
				lpSoundData[2]->SetPan((WormX[0]-200)*5);
				lpSoundData[2]->SetCurrentPosition(0);
				lpSoundData[2]->Play(NULL, NULL, 0);
			}

			PutInFood(rand()%5);

//			AddRipple(WormX[0]+4, WormY[0]+4, 2, -(rand()&0x7F));

			FoodXY[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 0xFF;

			if(RainTime > 20 && RainTime < 415)
			{
				Score += 10;
				if(WormSpeed <= 2)
				{
					EfctXY[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 11;
					EfctZ[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 0;
				}
				else
				{
					EfctXY[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 12;
					EfctZ[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 0;
				}
			}

			if(WormHoldCounter<=0)
			{
				WormGrowth();
			}
			else
			{
				WormStartCounter ++;
			}
		}
		else
		if(i == 0xFE || i == 0xFD)		// FE = GARY BODY	FD = LIVE BODY
		{
			WormDie();
			return;
		}

		FoodXY[WormX[0] / WORMSIZE][WormY[0] / WORMSIZE] = 0xFD;
		FoodXY[WormX[WormLength - 1] / WORMSIZE][WormY[WormLength - 1] / WORMSIZE] = 0xFF;

		for(i=WormLength; i>0; i--)
		{
			WormD[i] = WormD[i-1];
		}

		// move control
		i = WormD[0];

		if(WormX[0] % WORMSIZE == 0 && WormY[0] % WORMSIZE == 0)
		{
			j = GetKey();
			if(j == KEY_UP)// || KEYSTATUSFLAG[KEY_UP])
			{
				if(i != 2)
				{
					WormD[0] = 0;
				}
			}
			else
			if(j == KEY_RIGHT)// || KEYSTATUSFLAG[KEY_RIGHT])
			{
				if(i != 3)
				{
					WormD[0] = 1;
				}
			}
			else
			if(j == KEY_DOWN)// || KEYSTATUSFLAG[KEY_DOWN])
			{
				if(i != 0)
				{
			 		WormD[0] = 2;
				}
			}
			else
			if(j == KEY_LEFT)// || KEYSTATUSFLAG[KEY_LEFT])
			{
				if(i != 1)
				{
					WormD[0] = 3;
				}
			}
		}
	}

	// move head
	switch(WormD[0])
	{
		case 0:
			WormY[0] -= WormSpeed;
			break;
		case 1:
			WormX[0] += WormSpeed;
			break;
		case 2:
			WormY[0] += WormSpeed;
			break;
		case 3:
			WormX[0] -= WormSpeed;
			break;
	}

	if(WormX[0] < 0) WormX[0] += RENDER_WIDTH;
	if(WormY[0] < 0) WormY[0] += RENDER_HEIGHT;
	if(WormX[0] > RENDER_WIDTH - WORMSIZE) WormX[0] -= RENDER_WIDTH;
	if(WormY[0] > RENDER_HEIGHT - WORMSIZE) WormY[0] -= RENDER_HEIGHT;

	if(WormLength == 24)
	{
		if(lpSoundData[10])
		{
			lpSoundData[10]->SetPan((WormX[0]-200)*5);
		}
	}

	// move body
	for(i=1; i<WormLength; i++)
	{
		if(i >= WormLength - 1 && WormHoldCounter > 0) 
		{
			WormHoldCounter --;
			i = WormLength;
		}
		else
		{
			switch(WormD[i])
			{
			case 0:
				WormY[i] -= WormSpeed;
				break;
			case 1:
				WormX[i] += WormSpeed;
				break;
			case 2:
				WormY[i] += WormSpeed;
				break;
			case 3:
				WormX[i] -= WormSpeed;
				break;
			}

			if(WormX[i] < 0) WormX[i] += RENDER_WIDTH;
			if(WormY[i] < 0) WormY[i] += RENDER_HEIGHT;
			if(WormX[i] > RENDER_WIDTH - WORMSIZE) WormX[i] -= RENDER_WIDTH;
			if(WormY[i] > RENDER_HEIGHT - WORMSIZE) WormY[i] -= RENDER_HEIGHT;
		}
	}

	// check worm length
	CheckWormLength();
}

// -------------------------------------
//
// -------------------------------------

DWORD	PicScoreTemp[205*11+2];

void ShowScore(void)
{
	char		Buf[128];
	LPDWORD		temp;
	int			x = 6, y = 5, i;

	temp = lpRenderBuffer;
	SetRenderPage(SFX2PAGE);

	PutImage(3,3,PicScore);

	sprintf(Buf,"HISCORE %5ld   SCORE %5ld", HiScore, Score);
	for(i=8; i<12; i++)
	{
		if(Buf[i] == ' ')
		{
			Buf[i] = '0';
		}
		if(Buf[i+14] == ' ')
		{
			Buf[i+14] = '0';
		}
	}
//	SetColor(0x204020);
//	_OutTextXY(x+1, y, Buf);
	SetColor(0);
	_OutTextXY(x, y, Buf);

	if(EatTime < 4 || (EatTime == 4 && ((DayTime & 0x07) < 4)))
	{
		x = 174;
		for(i=0; i<EatTime; i++)
		{
			QuadTCK(x,y,x+6,y,x+6,y+6,x,y+6,
					0+EatColor*10,0,9+EatColor*10,0,9+EatColor*10,9,0+EatColor*10,9,FOODTXM);
			x += 8;
		}
	}

	_GetImage(3, 3, 205, 11, PicScoreTemp);

	lpRenderBuffer = temp;

	x = WormX[0]; y = WormY[0];

	if(WormDieCounter == 0)
	{
		if(y < 100)
		{
			PutImageAB(3, 3, PicScoreTemp, (y << 1));
		}
		else
		if(y > 200)
		{
			PutImageAB(3, 3, PicScoreTemp, 200 - ((y - 200) << 1));
		}
		else
		{
			PutImageAB(3, 3, PicScoreTemp, 200);
		}
	}
	else
	{
		i = 200;
		if(y < 100)
		{
			i = (y << 1);
		}
		else
		if(y > 200)
		{
			i = 200 - ((y - 200) << 1);
		}
		if(i < 200 && FramePassTime < 320) i += (320 - FramePassTime);
		PutImageAB(3, 3, PicScoreTemp, i);
	}
}

// -------------------------------------

void DrawBackground(void)
{
	PutImageBR(0, 0, PicBack, SceneBright);
}

// -------------------------------------

void DrawEfct(void)
{
	long	dx, dy;
	long	k, z;

	for(dy=0;dy<RENDER_HEIGHT;dy+=WORMSIZE)
	for(dx=0;dx<RENDER_WIDTH;dx+=WORMSIZE)
	{
		k = EfctXY[dx / WORMSIZE][dy / WORMSIZE];

		if(k < 0xFF)
		{
			z = EfctZ[dx / WORMSIZE][dy / WORMSIZE];

			switch(k)
			{
				case 0:
				case 1:
				case 2:
				case 3:
				case 4:
					QuadTCKAB(dx,dy,dx+9,dy,dx+9,dy+9,dx,dy+9,
						      0+k*10,0,9+k*10,0,9+k*10,9,0+k*10,9,FOODTXM,(z<<2));
					EfctZ[dx / WORMSIZE][dy / WORMSIZE] = z + 1;
					if(z == 63)
					{
						EfctXY[dx / WORMSIZE][dy / WORMSIZE] = 0xFF;
						FoodXY[dx / WORMSIZE][dy / WORMSIZE] = (BYTE)k;
						FoodZ[dx / WORMSIZE][dy / WORMSIZE] = 0;
					}
					break;
				case 201:
					EfctZ[dx / WORMSIZE][dy / WORMSIZE] = z + 1;
					AddRipple(dx + 4, dy + 5, 3, rand()&0xFF);
					if(z >= 8)
					{
						if(lpSoundData[4])
						{
							lpSoundData[4]->Stop();
							lpSoundData[4]->SetPan((dx-200)*5);
							lpSoundData[4]->SetCurrentPosition(0);
							lpSoundData[4]->Play(NULL, NULL, 0);
						}
						EfctXY[dx / WORMSIZE][dy / WORMSIZE] = 0xFF;
					}
					else
					{
						PutImageCKAD(dx, dy, PicWormBody);
					}
					break;
			}
		}
	}
}

// -------------------------------------

void DrawEfctAbove(void)
{
	long	dx, dy;
	long	k, z;

	for(dy=0;dy<RENDER_HEIGHT;dy+=WORMSIZE)
	for(dx=0;dx<RENDER_WIDTH;dx+=WORMSIZE)
	{
		k = EfctXY[dx / WORMSIZE][dy / WORMSIZE];

		if(k < 0xFF)
		{
			z = EfctZ[dx / WORMSIZE][dy / WORMSIZE];

			switch(k)
			{
				case 10:	// add 5
					if(z < 16)
						PutImageCK(dx-2,dy-z, PicAdd5);
					else
						PutImageCKAB(dx-2,dy-z, PicAdd5, 256-((z-16)<<4));
					if(z < 32) 
					{
						EfctZ[dx / WORMSIZE][dy / WORMSIZE] = z + 1;
					}
					else
					{
						EfctXY[dx / WORMSIZE][dy / WORMSIZE] = 0xFF;
					}
					break;
				case 11:	// add 10
					if(z < 16)
						PutImageCK(dx-4,dy-z, PicAdd10);
					else
						PutImageCKAB(dx-4,dy-z, PicAdd10, 256-((z-16)<<4));
					if(z < 32) 
					{
						EfctZ[dx / WORMSIZE][dy / WORMSIZE] = z + 1;
					}
					else
					{
						EfctXY[dx / WORMSIZE][dy / WORMSIZE] = 0xFF;
					}
					break;
				case 12:	// add 15
					if(z < 16)
						PutImageCK(dx-4,dy-z, PicAdd15);
					else
						PutImageCKAB(dx-4,dy-z, PicAdd15, 256-((z-16)<<4));
					if(z < 32) 
					{
						EfctZ[dx / WORMSIZE][dy / WORMSIZE] = z + 1;
					}
					else
					{
						EfctXY[dx / WORMSIZE][dy / WORMSIZE] = 0xFF;
					}
					break;
				case 30:	// add 30
					if(z < 16)
						PutImageCK(dx-4,dy-z, PicAdd30);
					else
						PutImageCKAB(dx-4,dy-z, PicAdd30, 256-((z-16)<<4));
					if(z < 32) 
					{
						EfctZ[dx / WORMSIZE][dy / WORMSIZE] = z + 1;
					}
					else
					{
						EfctXY[dx / WORMSIZE][dy / WORMSIZE] = 0xFF;
					}
					break;
			}
		}
	}
}

// -------------------------------------

void DrawShadow(void)
{
	long	dx, dy;
	long	j;

	// draw food shadow
	for(dy=0;dy<RENDER_HEIGHT;dy+=WORMSIZE)
	for(dx=0;dx<RENDER_WIDTH;dx+=WORMSIZE)
	{
		if(FoodXY[dx / WORMSIZE][dy / WORMSIZE] != 0xFF)
		{
			if(FoodXY[dx / WORMSIZE][dy / WORMSIZE] <= 5)
			{
				j = FoodZ[dx / WORMSIZE][dy / WORMSIZE];
				if(j < 6)
					PutImageCKSB(dx + 4 + j, dy + 4 + j, PicWormShadow);
				else
					PutImageCKSB(dx + 4 + j, dy + 4 + j, PicWormD[7-((63-j)>>3)]);
			}
			else
			if(FoodXY[dx / WORMSIZE][dy / WORMSIZE] == 0xFE)
			{
				PutImageCKSB(dx + 4, dy + 4, PicWormShadow);
			}
		}
		if(EfctXY[dx / WORMSIZE][dy / WORMSIZE] == 201)
		{
			PutImageCKSB(dx + 4, dy + 4, PicWormShadow);
		}
	}
}

// -------------------------------------

void DrawFoodUnderWater(void)
{
	long	dx, dy;
	long	j, k;

	// draw food under water
	for(dy=0;dy<RENDER_HEIGHT;dy+=WORMSIZE)
	for(dx=0;dx<RENDER_WIDTH;dx+=WORMSIZE)
	{
		if(FoodXY[dx / WORMSIZE][dy / WORMSIZE] != 0xFF)
		{
			if(FoodXY[dx / WORMSIZE][dy / WORMSIZE] <= 6)
			{
				j = FoodZ[dx / WORMSIZE][dy / WORMSIZE];
				k = FoodXY[dx / WORMSIZE][dy / WORMSIZE];
				k = k * WORMSIZE;
				if(j == 5)
				{
					if(lpSoundData[1])
					{
						lpSoundData[1]->Stop();
						lpSoundData[1]->SetCurrentPosition(0);
						lpSoundData[1]->SetPan((dx-200)*5);
						lpSoundData[1]->Play(NULL, NULL, 0);
					}
				}
				if(j < 6)
				{
					QuadTCKAB(dx-j,dy-j,dx+9+j,dy-j,dx+9+j,dy+9+j,dx-j,dy+9+j,
						      0+k,0,9+k,0,9+k,9,0+k,9,FOODTXM, 255-(j<<2));

					if(j > 0)
					{
						FoodZ[dx / WORMSIZE][dy / WORMSIZE] --;
						AddRipple(dx+4, dy+5, 3, -((rand()&0x3F)+0xFF));
					}
				}
			}
			else
			if(FoodXY[dx / WORMSIZE][dy / WORMSIZE] == 0xFE)
			{
				PutImageCK(dx,dy,PicWormBox);
			}
		}
	}
}

// -------------------------------------

void DrawEye(void)
{
	long	dx, dy;
	long	u1, u2, u3, u4, v1, v2, v3, v4;
	long	ax, ay;
	long	axl, ayl, axr, ayr;
	long	i;

	dx = WormX[0] / WORMSIZE;
	dy = WormY[0] / WORMSIZE;

	switch(WormEyeStatus)
	{
		case 1:
		case 2:
		case 3:
			WormEyeStatus = 0;
			break;
		case 4:
			WormEyeStatus = 2;
			break;
		case 5:
			WormEyeStatus = 3;
			break;
	}

	switch(WormD[0])
	{
		case 0:
			ax = 0; ay = -1;
			axl = -1; ayl = 0; axr = 1; ayr = 0;
			break;
		case 1:
			ax = 1; ay = 0;
			axl = 0; ayl = -1; axr = 0; ayr = 1;
			break;
		case 2:
			ax = 0; ay = 1;
			axl = 1; ayl = 0; axr = -1; ayr = 0;
			break;
		case 3:
			ax = -1; ay = 0;
			axl = 0; ayl = 1; axr = 0; ayr = -1;
			break;
	}

	i = 0;

	if(FoodXY[dx+ax][dy+ay]>0xFD)
	{
		if(FoodXY[dx+ax+axl][dy+ay+ayl]<0x70 && dx+ax+axl>=0 && dx+ax+axl<RENDER_WIDTH/WORMSIZE && dy+ay+ayl>=0 && dy+ay+ayl<RENDER_HEIGHT/WORMSIZE)
		{
			WormEyeStatus = 3;
		}
		else
		if(FoodXY[dx+ax+axr][dy+ay+ayr]<0x70 && dx+ax+axr>=0 && dx+ax+axr<RENDER_WIDTH/WORMSIZE && dy+ay+ayr>=0 && dy+ay+ayr<RENDER_HEIGHT/WORMSIZE)
		{
			WormEyeStatus = 2;
		}
		else
		if(FoodXY[dx+axl][dy+ayl]<0x70 && dx+axl>=0 && dx+axl<RENDER_WIDTH/WORMSIZE && dy+ayl>=0 && dy+ayl<RENDER_HEIGHT/WORMSIZE)
		{
			WormEyeStatus = 5;
		}
		else
		if(FoodXY[dx+axr][dy+ayr]<0x70 && dx+axr>=0 && dx+axr<RENDER_WIDTH/WORMSIZE && dy+ayr>=0 && dy+ayr<RENDER_HEIGHT/WORMSIZE)
		{
			WormEyeStatus = 4;
		}
		else
		if(FoodXY[dx-ax+axl][dy-ay+ayl]<0x70 && dx-ax+axl>=0 && dx-ax+axl<RENDER_WIDTH/WORMSIZE && dy-ay+ayl>=0 && dy-ay+ayl<RENDER_HEIGHT/WORMSIZE)
		{
			WormEyeStatus = 5;
		}
		else
		if(FoodXY[dx-ax+axr][dy-ay+ayr]<0x70 && dx-ax+axr>=0 && dx-ax+axr<RENDER_WIDTH/WORMSIZE && dy-ay+ayr>=0 && dy-ay+ayr<RENDER_HEIGHT/WORMSIZE)
		{
			WormEyeStatus = 4;
		}
	}

	if(WormHoldCounter && WormLength >= 5 && (WormX[0] % WORMSIZE != 0 || WormY[0] % WORMSIZE != 0))
	{
		WormEyeStatus = 1;
	}

	dx = WormX[0]; dy = WormY[0];

	switch(WormD[0])
	{
		case 0:
			u1 = 9; v1 = 19; u2 = 0; v2 = 19;
			u3 = 0; v3 = 10; u4 = 9; v4 = 10;
			break;
		case 1:
			u1 = 9; v1 = 10; u2 = 9; v2 = 19;
			u3 = 0; v3 = 19; u4 = 0; v4 = 10;
			break;
		case 2:
			u1 = 0; v1 = 10; u2 = 9; v2 = 10;
			u3 = 9; v3 = 19; u4 = 0; v4 = 19;
			break;
		case 3:
			u1 = 0; v1 = 19; u2 = 0; v2 = 10;
			u3 = 9; v3 = 10; u4 = 9; v4 = 19;
			break;
	}

	switch(WormEyeStatus)
	{
		case 0:
			QuadTCK(dx,dy,dx+9,dy,dx+9,dy+9,dx,dy+9,
				u1,v1,u2,v2,u3,v3,u4,v4,FOODTXM);
			break;
		case 1:
			QuadTCK(dx,dy,dx+9,dy,dx+9,dy+9,dx,dy+9,
				u1+10,v1,u2+10,v2,u3+10,v3,u4+10,v4,FOODTXM);
			break;
		case 2:
			QuadTCK(dx,dy,dx+9,dy,dx+9,dy+9,dx,dy+9,
				u1+20,v1,u2+20,v2,u3+20,v3,u4+20,v4,FOODTXM);
			break;
		case 3:
			QuadTCK(dx,dy,dx+9,dy,dx+9,dy+9,dx,dy+9,
				u1+30,v1,u2+30,v2,u3+30,v3,u4+30,v4,FOODTXM);
			break;
		case 4:
			QuadTCK(dx,dy,dx+9,dy,dx+9,dy+9,dx,dy+9,
				u1+40,v1,u2+40,v2,u3+40,v3,u4+40,v4,FOODTXM);
			break;
		case 5:
			QuadTCK(dx,dy,dx+9,dy,dx+9,dy+9,dx,dy+9,
				u1+50,v1,u2+50,v2,u3+50,v3,u4+50,v4,FOODTXM);
			break;
		case 6:
			QuadTCK(dx-2,dy-2,dx+9+2,dy-2,dx+9+2,dy+9+2,dx-2,dy+9+2,
				u1,v1,u2,v2,u3,v3,u4,v4,FOODTXM);
			break;
	}
}

// -------------------------------------

void DrawWormShadow(void)
{
	long	i;

	// draw worm shadow
	for(i=0; i<WormLength; i++)
	{
		PutImageCKSB(WormX[i]+4,WormY[i]+4,PicWormShadow);
	}
}

// -------------------------------------

void DrawWorm(void)
{
	long	i, j;

	// draw worm body
	j = 9;
	if(WormLength < j) j = WormLength;

	PutImageCKAD(WormX[0], WormY[0], PicWormBody);

	for(i = 1; i < j; i ++)
	{
		PutImageCKAD(WormX[i], WormY[i], PicWormB[i-1]);
	}

	for(i = 0; i < WormLength; i ++)
	{
		PutImageCKAD(WormX[i], WormY[i], PicWormBody);
	}

	DrawEye();
}

// -------------------------------------

void DrawWormShadow2(void)
{
	long	i;

	if(WormLife[WormLength - 1] < 8)
	{
		for(i = 0; i < WormLength; i ++)
		{
			if(WormLife[i] > 0)
				PutImageSB(WormX[i] + 4, WormY[i] + 4, PicWormD[WormLife[i]-1]);
			else
				PutImageSB(WormX[i] + 4, WormY[i] + 4, PicWormShadow);
		}
	}
}

// -------------------------------------

void DrawWorm2(void)
{
	long	i;

	if(WormHoldCounter > 0)
	{
		DrawWorm();
		WormHoldCounter --;
		return;
	}

	if(WormDieCounter < 8)
	{
		WormLife[0] = WormDieCounter;
		WormDieCounter ++;
	}

	if(WormLife[WormLength - 1] < 8)
	{
		for(i = WormLength - 1; i >= 1; i --)
		{
			if(WormLife[i - 1] >= 3 && WormLife[i] < 8)
				WormLife[i] ++;
		}

		for(i = 0; i < WormLength; i ++)
		{
			if(WormLife[i] == 1)
			{
				if(lpSoundData[4])
				{
					lpSoundData[4]->Stop();
					lpSoundData[4]->SetPan((WormX[i]-200)*5);
					lpSoundData[4]->SetCurrentPosition(0);
					lpSoundData[4]->Play(NULL, NULL, 0);
				}
			}

			if(WormLife[i] >= 2)
				AddRipple(WormX[i] + 4, WormY[i] + 5, 2, rand()&0x1FF);

			if(WormLife[i] > 0)
				PutImageCKAD(WormX[i],WormY[i], PicWormB[WormLife[i] - 1]);
			else
				PutImageCKAD(WormX[i],WormY[i], PicWormBody);
		}
	}
}

// -------------------------------------

void DrawFoodAboveWater(void)
{
	long	dx, dy;
	long	j, k;

	for(dy=0;dy<RENDER_HEIGHT;dy+=WORMSIZE)
	for(dx=0;dx<RENDER_WIDTH;dx+=WORMSIZE)
	{
		k = FoodXY[dx / WORMSIZE][dy / WORMSIZE];
		if(k<=5)
		{
			j = FoodZ[dx / WORMSIZE][dy / WORMSIZE];
			k = k * WORMSIZE;

			if(j >= 6)
			{
				QuadTCKAB(dx-j,dy-j,dx+9+j,dy-j,dx+9+j,dy+9+j,dx-j,dy+9+j,
						0+k,0,9+k,0,9+k,9,0+k,9,FOODTXM, 255-(j<<2));
				if(j > 0) FoodZ[dx / WORMSIZE][dy / WORMSIZE] -= (1 + ((63-FoodZ[dx / WORMSIZE][dy / WORMSIZE])>>4));
			}
		}
	}
}

// -------------------------------------

void DrawNightLight(void)
{
	long	dx, dy, a;

	if(SceneBright<250)
	{
		dx = WormX[0]+4; dy = WormY[0]+4;
		a= (256 - SceneBright) >> 1;
		QuadTCKAD(dx-a,dy-a,dx+1+a,dy-a,dx+1+a,dy+1+a,dx-a,dy+1+a,
			0,0,63,0,63,63,0,63,BRIGHTTXM);
	}
}

// -------------------------------------

void DrawNightLight2(void)
{
	long	dx, dy, a;

	if(SceneBright<250 && WormHoldCounter > 0)
	{
		dx = WormX[0]+4; dy = WormY[0]+4;
		a = (256 - SceneBright) >> 1;
		a = ((a * WormHoldCounter) >> 5);
		QuadTCKAD(dx-a,dy-a,dx+1+a,dy-a,dx+1+a,dy+1+a,dx-a,dy+1+a,
			0,0,63,0,63,63,0,63,BRIGHTTXM);
	}
}

// -------------------------------------

void DrawSun(void)
{
	long	dx, dy, a;

	if(DayTime==2700)		
		MoonFull = !MoonFull;

	if(DayTime>2700 && DayTime<2700+500)
	{
		dy = 2950 + 100 - DayTime;
		dx = 200;
		
		a= 32;

		if(MoonFull)
			QuadTCKAB(dx-a,dy-a,dx+a,dy-a,dx+a,dy+a,dx-a,dy+a,
				64,0,127,0,127,63,64,63,BRIGHTTXM,(150-abs(dy-150)));
		else
			QuadTCKAB(dx-a,dy-a,dx+a,dy-a,dx+a,dy+a,dx-a,dy+a,
				64,64,127,64,127,127,64,127,BRIGHTTXM,(150-abs(dy-150)));
	}
//		QuadTCKAB(dx-a,dy-a,dx+a,dy-a,dx+a,dy+a,dx-a,dy+a,
//			0,64,63,64,63,127,0,127,BRIGHTTXM,(150-abs(150-dy)));
}

// -------------------------------------

void DrawScene(void)
{
	SetRenderPage(BACKPAGE);

	DrawBackground();

	DrawShadow();
	DrawWormShadow();

	DrawNightLight();

	DrawFoodUnderWater();

	DrawWorm();

	DrawEfct();

	DrawSun();

	GoldenLight();

	SetRenderPage(MAINPAGE);
	RippleSpread();
	RenderRipple();
	SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);

	DrawEfctAbove();
	DrawFoodAboveWater();

	ShowScore();
	
	ResetClipBox();
}

// -------------------------------------

void DrawScene2(void)
{
	SetRenderPage(BACKPAGE);

	DrawBackground();

	DrawShadow();
	DrawWormShadow2();

	DrawNightLight2();

	DrawFoodUnderWater();
	
	DrawWorm2();

	DrawEfct();

	DrawSun();

	GoldenLight();

	SetRenderPage(MAINPAGE);
	RippleSpread();
	RenderRipple();
	SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);

	DrawEfctAbove();
	DrawFoodAboveWater();

	ShowScore();

	ResetClipBox();
}

// -------------------------------------
//
// -------------------------------------

void Rain(void)
{
	// rain
	if(RainTime > 0)
	{
		RainTime --;

		if(RainTime == 499)
		{
			if(lpSoundData[6])
			{
				lpSoundData[6]->Play(NULL, NULL, 0);
			}
		}

		if(RainTime == 450)
		{
			RainSoundVolume = -10000;
			if(lpSoundData[7])
			{
				lpSoundData[7]->SetVolume(RainSoundVolume);
				lpSoundData[7]->Play(NULL, NULL, 1);
			}
		}

		if(RainTime < 450 && RainTime > 100)
		{
			if(RainSoundVolume<0)
			{
				RainSoundVolume += 400;
        		if(lpSoundData[7])
		        {
				    lpSoundData[7]->SetVolume(RainSoundVolume);
                }
			}
		}

		if(RainTime < 440)
		{
			if(RainTime > 100 && (RainTime & 0x3F) == 0)
				PutInFood(3);

			for(int i=0;i<2;i++)
				AddRipple(rand() % RENDER_WIDTH, rand() % RENDER_HEIGHT, 3, -rand()&0xFF);

			if(RainTime>150 && rand() < 1500)
			{
				if(lpSoundData[8])
				{
					lpSoundData[8]->Play(NULL, NULL, 0);
				}
			}
		}

		if(RainTime < 50)
		{
			if(RainSoundVolume > -10000)
			{
				RainSoundVolume -= 200;
        		if(lpSoundData[7])
		    	{
				    lpSoundData[7]->SetVolume(RainSoundVolume);
                }
			}
		}

		if(RainTime == 0)
		{
			if(lpSoundData[7])
			{
				lpSoundData[7]->Stop();
			}
		}
	}
}

// -------------------------------------

void TimePass(void)
{
	DayTime ++;
	if(DayTime >= 3500) DayTime = 0;

	if(DayTime > 3500 - 16)
	{
		if(SceneBright > 0) SceneBright -= 4;
	}

	if(DayTime == 0)
	{
		BG_CNT ++;
		if(BG_CNT >= EndVideoFrame) BG_CNT=0;
		LoadBG();
	}

	if(DayTime <= 256)
	{
		if(SceneBright < 64) SceneBright += 4;
		else
		if(SceneBright < 256) SceneBright ++;
	}

	if(DayTime > 2500 - 256)
	{
		if(SceneBright > 64) SceneBright --;
	}
}

// -------------------------------------
//
// -------------------------------------

long	menuitem = 0;

void GameLoop(void)
{
	long	dx, dy;
	long	i, j;

	// time control
	if((GameTime1 = timeGetTime())<GameTime2) return;// RefreshScreen();
	GameTime2 = GameTime1 + 40;

	switch(GameStatus)
	{
		case -12:
			SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);
			PutImage(0, 0, PicTitle2);
			SetClipBox(63, 136+28*menuitem, 221, 136+28*menuitem+27);
			PutImage(63, 136, PicTitle);

			SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);
			PutImageAB(0, 0, PicHelpInfo, 256 - SceneBright);

			if(SceneBright < 256)
				SceneBright += 32;
			else
			{
				GameStatus = -2;
				PutImage(0, 0, PicTitle2);
				SetClipBox(63, 136+28*menuitem, 221, 136+28*menuitem+27);
				PutImage(63, 136, PicTitle);
				ResetKeyBuffer();
			}

			RefreshScreen();
			break;

		case -11:
			SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);
			PutImage(0,0,PicHelpInfo);

			i = GetKey();

			if(i == KEY_UP || i == KEY_DOWN || i == KEY_ENTER)
			{
				SceneBright = 0;
				GameStatus = -12;
			}
			RefreshScreen();
			break;

		case -10:
			if(SceneBright > 0)
				SceneBright -= 32;
			else
				GameStatus = -11;

			SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);
			PutImage(0, 0, PicTitle2);
			PutImageAB(0, 0, PicHelpInfo, 256 - SceneBright);

			RefreshScreen();
			break;

		case -1:
			if(SceneBright <= 3)
			if(lpSoundData[90])
			{
				lpSoundData[90]->SetVolume(0);
				lpSoundData[90]->Play(NULL, NULL, 1);
			}

			i = GetKey();

			if(i == KEY_UP || i == KEY_DOWN || i == KEY_ENTER)
			{
				SceneBright = 256;
			}

			if(SceneBright < 256)
				SceneBright += 3;
			
			SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);
			PutImageBR(0,0,PicTitle2, SceneBright);

			SetClipBox(63, 136+28*menuitem, 221, 136+28*menuitem+27);
			PutImageBR(63, 136, PicTitle, SceneBright);

			RefreshScreen();

			if(SceneBright >= 256)
			{
				BG_CNT = 0;
				LoadBG();
				ResetKeyBuffer();
				SceneBright = 256;
				GameStatus = -2;
			}
			break;

		case -2:
			SetClipBox(63, 136, 221, 222);
			PutImage(0,0,PicTitle2);

			SetClipBox(63, 136+28*menuitem, 221, 136+28*menuitem+27);
			PutImage(63, 136, PicTitle);

			SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);
			RefreshScreen();

			i = GetKey();

			if(i == KEY_UP)
			{
				if(lpSoundData[92])
				{
					lpSoundData[92]->SetCurrentPosition(0);
					lpSoundData[92]->Play(NULL, NULL, 0);
				}
				menuitem --;
				if(menuitem < 0) menuitem += 3;
			}
			else
			if(i == KEY_DOWN)
			{
				if(lpSoundData[92])
				{
					lpSoundData[92]->SetCurrentPosition(0);
					lpSoundData[92]->Play(NULL, NULL, 0);
				}
				menuitem ++;
				if(menuitem > 2) menuitem -= 3;
			}
			else
			if(i == KEY_ENTER)
			{
				SetClipBox(63, 136, 221, 222);
				PutImage(0,0,PicTitle2);
				SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);

				if(lpSoundData[91])
				{
					lpSoundData[91]->SetCurrentPosition(0);
					lpSoundData[91]->Play(NULL, NULL, 0);
				}

				GameTime2 = timeGetTime() + 100;

				switch(menuitem)
				{
					case 0:
						SceneBright = 256;
						GameStatus = -3;
						break;

					case 1:
						SceneBright = 256;
						GameStatus = -10;
						break;

					case 2:
						FramePassTime = 256;
						GameStatus = 99;
						break;
				}
			}
			break;

		case -3:
			if(SceneBright > 0)
			{
				if(lpSoundData[90])
				{
					lpSoundData[90]->SetVolume(-((256-SceneBright)*18));
				}
				SceneBright -= 4;
				PutImage(0, 0, PicTitle2);
				PutImageAB(0, 0, PicBack, 256 - SceneBright);
			}
			else
			{
//				ClearRenderBuffer(MAINPAGE);

				GameStatus = 0;
				if(lpSoundData[90])
				{
					lpSoundData[90]->Stop();
					lpSoundData[90]->SetVolume(0);
					lpSoundData[90]->SetCurrentPosition(0);
				}
			}

			RefreshScreen();
			break;

		case 0:
			// init rand()
			j = timeGetTime() & 0x0FFF;
			for(i=0;i<j;i++) dx = rand();

			// set time
			GameTime1 = timeGetTime();
			GameTime2 = GameTime1;

			// clear food buffer
			for(dy=0; dy<RENDER_HEIGHT/WORMSIZE; dy++)
			for(dx=0; dx<RENDER_WIDTH/WORMSIZE; dx++)
			{
				FoodXY[dx][dy] = 0xFF;
				FoodZ[dx][dy] = 0;

				EfctXY[dx][dy] = 0xFF;
				EfctZ[dx][dy] = 0;
			}

			// set worm data
			for(i=0; i<MAXWORMLEN; i++)
			{
				WormD[i] = 0;
				WormLife[i] = 0;
			}

			// set start size
			WormStartCounter = 4;

			// set worm place
			WormLength = 1;
			WormHoldCounter = 0;
			WormEyeStatus = 0;

			for(i=0; i<WormLength; i++)
			{
				WormX[i] = 200;
				WormY[i] = 290 + i * 10;
			}

			WormSpeed = 2;
			WormSpeedTime = 0;

			// throw in food
			FoodCounter = 4;
			PutInFood(FoodCounter --);

			SearchStart = 0;
			SearchEnd = 0;

			// start water sound
			WaterSoundVolume = -10000;
			if(lpSoundData[0])
			{
				lpSoundData[0]->SetVolume(WaterSoundVolume);
				lpSoundData[0]->Play(NULL, NULL, 1);
			}

			DayTime = 256;
			SceneBright = 256;
			EatTime = 0; 

			Score = 0;

			GameStatus = 1;
			BG_CNT = 0;
			LoadBG();

			ClearSFXBuffer();
			ResetKeyBuffer();
			break;

		case 1:
/*
if(KEYSTATUSFLAG[KEY_SPACE])
{
	BeanChange();
	PutInFood(4);
}
*/
            if(KEYSTATUSFLAG[KEY_SPACE])    // PAUSE
            {
    			if(GetKey() == KEY_SPACE)
                {
    				GameStatus = 3;

    				if(lpSoundData[91])
	    			{
		    			lpSoundData[91]->SetCurrentPosition(0);
			    		lpSoundData[91]->Play(NULL, NULL, 0);
				    }
                }
            }


			if(WormHoldCounter == 1 && FoodCounter >= 0)
			{
				PutInFood(FoodCounter --);
			}

			// water sound
			if(lpSoundData[0])
			{
				lpSoundData[0]->SetPan((WormX[1]-200)*5);
			}

			if(WaterSoundVolume < 0)
			{
				WaterSoundVolume += 400;
				if(lpSoundData[0])
				{
					lpSoundData[0]->SetVolume(WaterSoundVolume);
				}
			}

			// time process
			TimePass();

			// move worm
			WormMoveStep();

			// add length size
			if(WormStartCounter>0 && WormHoldCounter<=0)
			{	
				WormStartCounter --;
				WormGrowth();
			}

			// move control
			if((KEYSTATUSFLAG[KEY_UP] && WormD[0] != 2) ||
			   (KEYSTATUSFLAG[KEY_DOWN] && WormD[0] != 0) ||
			   (KEYSTATUSFLAG[KEY_LEFT] && WormD[0] != 1) ||
			   (KEYSTATUSFLAG[KEY_RIGHT] && WormD[0] != 3))
			{
				AddRipple(WormX[1]+4, WormY[1]+5, 2, rand()&0x7F);
			}
/*
			// free ripple by mouse
			if(MouseButton0)
			{
				AddRipple(MOUSEX, MOUSEY, 2, -rand()&0xFF);
			}
*/
			Rain();

			// env sound
			if(SceneBright > 200 && RainTime <= 0 && rand() < (WormLength << 4))
			{
				i = rand() % 14;
				if(lpSoundData[101 + i])
				{
					lpSoundData[101 + i]->SetPan((rand()%4000)-2000);
					lpSoundData[101 + i]->SetVolume(-(rand()%2000));
					lpSoundData[101 + i]->Play(NULL, NULL, 0);
				}
			}

			DrawScene();

			RefreshScreen();
			break;

		case 2:
			// restart
			if(FramePassTime > 0  && GetKey() != KEY_ENTER)
			{
				if(FramePassTime < SceneBright) SceneBright = FramePassTime;
				FramePassTime --;
			}
			else
			{
				for(i=0;i<256;i++)
				{
					if(lpSoundData[i])
						lpSoundData[i]->Stop();
				}
				SceneBright = 0;
				RainTime = 0;
				GameStatus = -1;
			}
/*
			// free ripple by mouse
			if(MouseButton0)
			{
				AddRipple(MOUSEX, MOUSEY, 2, -rand()&0x0FF);
			}
*/
			// time process
			TimePass();

			Rain();

			DrawScene2();

			RefreshScreen();
			break;

        case 3: // pause
            if(KEYSTATUSFLAG[KEY_SPACE])    // PAUSE
            {
    			if(GetKey() == KEY_SPACE)
                {
    				GameStatus = 1;

    				if(lpSoundData[91])
	    			{
		    			lpSoundData[91]->SetCurrentPosition(0);
			    		lpSoundData[91]->Play(NULL, NULL, 0);
				    }
                }
            }
			RefreshScreen();
			break;

		case 99:
			if(FramePassTime > 0)
			{
				FramePassTime -= 6;
				if(lpSoundData[90])
				{
					lpSoundData[90]->SetVolume(-((256-FramePassTime)*18));
				}
			}
			else
			{
				bLive = FALSE;
			}

			if(FramePassTime < SceneBright) SceneBright = FramePassTime;

			SetClipBox(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2);
			PutImageBR(0,0,PicTitle2, SceneBright);

			RefreshScreen();
			break;
	}
/*
	QuadGouraud(0,0,399,0,399,399,0,399,0xFF0000,0,0x00FF00,0x0000FF);
	WhiteNoise();
*/
}

/* to do:
		3. weather			// rand by status
		5. background
*/ 