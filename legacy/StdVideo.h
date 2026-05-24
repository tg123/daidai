////////////////////////////////////////////////
//
//  Standard Video Function: StdVideo.h
//
////////////////////////////////////////////////

#include <VFW.H>

/*--------------------------------------*/

BOOL			VideoPlayingFlag;

DWORD			rawdata[RENDER_HEIGHT * RENDER_WIDTH];
DWORD			VideoDataBuffer[RENDER_HEIGHT * RENDER_WIDTH];

PAVISTREAM 		VideoStream;
AVISTREAMINFO	VideoStreamInfo;

HIC				decomp;

long			fmtlen;
long			VideoBufLen;
long			VideoWidth, VideoHeight;
long			VideoBits;
long			VideoRate, VideoScale;
long			StartVideoFrame, EndVideoFrame;

BYTE			VideoSrcFmt[40];
BYTE			VideoDstFmt[40];

PAVISTREAM 		AudioStream;
AVISTREAMINFO	AudioStreamInfo;

WAVEFORMATEX 	AudioSrcFmt;
/*
    WORD  wFormatTag;
	WORD  nChannels; 
    DWORD nSamplesPerSec; 
    DWORD nAvgBytesPerSec;
	WORD  nBlockAlign;   
	WORD  wBitsPerSample; 
*/

long			StartAudioFrame, EndAudioFrame;
long			AudioBufLen;

LPDIRECTSOUNDBUFFER		lpAudioDataBuffer;

/*--------------------------------------*/

void OpenAudioStream(char *FileName)
{
	long res;

	if (AudioStream)
	{
		AVIStreamRelease(AudioStream);
		AudioStream = 0;
	}

	res = AVIStreamOpenFromFile(&AudioStream, FileName, streamtypeAUDIO, 0, OF_READ, 0);

	if(res == 0)
	{
		res = AVIStreamFormatSize(AudioStream, 0, &fmtlen);
		if(res == 0 && fmtlen <= 16)
		{
			res = AVIStreamReadFormat(AudioStream, 0, &AudioSrcFmt, &fmtlen);
			if(res == 0)
			{
				if(AudioSrcFmt.wFormatTag==WAVE_FORMAT_PCM)
				{
					StartAudioFrame = AVIStreamStart(AudioStream);
					EndAudioFrame = AVIStreamEnd(AudioStream);
				
					AudioBufLen = (EndAudioFrame - StartAudioFrame) * AudioSrcFmt.nChannels * (AudioSrcFmt.wBitsPerSample/8);

					RELEASE(lpAudioDataBuffer);
					if(CreateDirectSoundBuffer((LPBYTE)(&AudioSrcFmt), AudioBufLen, &lpAudioDataBuffer))
					{
						{
						    LPVOID		lpvPtr1; 
							DWORD		dwBytes1; 
							LPVOID		lpvPtr2; 
							DWORD		dwBytes2; 
							HRESULT		hres;

							hres = lpAudioDataBuffer->SetCurrentPosition(0);
							hres = lpAudioDataBuffer->Lock(0, AudioBufLen, &lpvPtr1, &dwBytes1, &lpvPtr2, &dwBytes2, 0);

						    if(DSERR_BUFFERLOST == hres) 
							{
								lpAudioDataBuffer->Restore();
								hres = lpAudioDataBuffer->Lock(0, AudioBufLen, &lpvPtr1, &dwBytes1, &lpvPtr2, &dwBytes2, 0);
							}

							if(DS_OK == hres) 
							{
								res = AVIStreamRead(AudioStream, StartAudioFrame, EndAudioFrame - StartAudioFrame, lpvPtr1, AudioBufLen, 0, 0);
								hres = lpAudioDataBuffer->Unlock(lpvPtr1, dwBytes1, lpvPtr2, dwBytes2);
							}
						}
					}
				}
			}
		}
	}
	if (AudioStream)
	{
		AVIStreamRelease(AudioStream);
		AudioStream = 0;
	}
}

/*--------------------------------------*/

int OpenVideoStream(char *FileName)
{	
	long res;

	LPBITMAPINFOHEADER	lpsrcfmt = (LPBITMAPINFOHEADER)VideoSrcFmt;
	LPBITMAPINFOHEADER	lpdstfmt = (LPBITMAPINFOHEADER)VideoDstFmt;

	if (VideoStream)
	{
		AVIStreamRelease(VideoStream);
		VideoStream = 0;
	}

	res = AVIStreamOpenFromFile(&VideoStream, FileName, streamtypeVIDEO, 0, OF_READ, 0);

	if(res == 0)
	{
		res = AVIStreamFormatSize(VideoStream, 0, &fmtlen);
		if(res == 0 && fmtlen <= 40)
		{
			res = AVIStreamReadFormat(VideoStream, 0, VideoSrcFmt, &fmtlen);
			if(res == 0)
			{
				VideoWidth = lpsrcfmt->biWidth;
				VideoHeight = lpsrcfmt->biHeight;
				VideoBits = lpsrcfmt->biBitCount;

				StartVideoFrame = AVIStreamStart(VideoStream);
				EndVideoFrame = AVIStreamEnd(VideoStream);


				memcpy(VideoDstFmt, VideoSrcFmt, fmtlen);
				lpdstfmt->biBitCount = 32;
				lpdstfmt->biCompression = BI_RGB;
				lpdstfmt->biSizeImage = VideoWidth * VideoHeight * 4;

				if(VideoWidth <= RENDER_WIDTH && VideoHeight <= RENDER_HEIGHT)
				{
					res = AVIStreamInfo(VideoStream, &VideoStreamInfo, sizeof(VideoStreamInfo));
					if(res == 0)
					{
						VideoBufLen = lpdstfmt->biSizeImage;
						VideoRate = VideoStreamInfo.dwRate;
						VideoScale = VideoStreamInfo.dwScale;

						if(decomp)
						{
							ICClose(decomp);
						}
						decomp = ICDecompressOpen(ICTYPE_VIDEO, VideoStreamInfo.fccHandler, lpsrcfmt, lpdstfmt);
						if(decomp!=0)
						{
							return TRUE;
						}
					}
				}
			}
		}
	}
	return FALSE;
}

/*--------------------------------------*/

void LoadVideoFrame(long num)
{
	long res;
	LPBITMAPINFOHEADER	lpsrcfmt = (LPBITMAPINFOHEADER)VideoSrcFmt;
	LPBITMAPINFOHEADER	lpdstfmt = (LPBITMAPINFOHEADER)VideoDstFmt;

	res = AVIStreamRead(VideoStream, num, 1, rawdata, VideoBufLen, 0, 0);
	ICDecompress(decomp, 0, lpsrcfmt, rawdata, lpdstfmt, VideoDataBuffer);
}

/*--------------------------------------*/

int OpenVideoFile(char *FileName)
{
	if(OpenVideoStream(FileName))
	{
		OpenAudioStream(FileName);
		return TRUE;
	}
	return FALSE;
}

/*--------------------------------------*/

void CloseVideoFile(void)
{	
	RELEASE(lpAudioDataBuffer);

	if(decomp)
	{
		ICClose(decomp);
		decomp = NULL;
	}

	if(AudioStream)
	{
		AVIStreamRelease(AudioStream);
		AudioStream = NULL;
	}

	if(VideoStream)
	{
		AVIStreamRelease(VideoStream);
		VideoStream = NULL;
	}
}

/*--------------------------------------*/

void FilpWholeVideoBuffer(void)		// filp video image
{
	LPDWORD		lpSrc = (LPDWORD)VideoDataBuffer + VideoWidth * (VideoHeight - 1);
	DWORD		LineOff = (RENDER_WIDTH - VideoWidth) / 2 * 4;
	DWORD		LineOff2 = VideoWidth * 4 * 2;
	DWORD		HighOff = (RENDER_HEIGHT - VideoHeight) * RENDER_WIDTH / 2 * 4;

	_asm {
		MOV		ESI, lpSrc
		MOV		EDI, lpRenderBuffer
		ADD		EDI, HighOff

		MOV		EDX,VideoHeight

ExpandVideoBuffer_LoopY:
		ADD		EDI, LineOff

		MOV		ECX, VideoWidth
		REP		MOVSD

		ADD		EDI, LineOff

		SUB		ESI,LineOff2

		DEC		EDX
		JNZ		ExpandVideoBuffer_LoopY
	}
}

/*--------------------------------------*/
void RefreshScreen(void);

void PlayAVIFile(char *FileName)
{
	long		frame;
	long		time1, time2, time3;
    MSG			msg;
	double		temp;

	if(OpenVideoFile(FileName)==FALSE) return;

	frame = StartVideoFrame;

	ClearRenderBuffer(0);

	time1 = timeGetTime();
	time2 = time1;
	time3 = 0;

	VideoPlayingFlag = TRUE;

	do
	{
        if(PeekMessage(&msg, NULL, 0, 0, PM_NOREMOVE))
        {
            if (!GetMessage(&msg, NULL, 0, 0)) return;// msg.wParam;
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
		else
		{
	        if(bActive)
		    {
				if(time3 > 0)
				{
					time2 += time3;
					time3 = 0;
				}

				time1 = timeGetTime();
				temp= (frame - StartVideoFrame) * VideoScale * 1000.0 / VideoRate;
				if((time1 - time2) >= (long)temp)
				{
					LoadVideoFrame(frame);
					frame++;
					if(frame >= EndVideoFrame)
					{
						VideoPlayingFlag = FALSE;
					}
					if(frame <= StartVideoFrame+1)
					{
						if(lpAudioDataBuffer)
							lpAudioDataBuffer->Play(NULL, NULL, 0);
					}
					FilpWholeVideoBuffer();
				}
				RefreshScreen();
			}
			else
			{
				time3 = timeGetTime() - time1;
			}
		}
	}	while(VideoPlayingFlag);

	CloseVideoFile();
	if(bLive == FALSE)	// program need exit
	{
		DestroyWindow(hWndCopy);
	}

	return;
}

/*--------------------------------------*/

void LoopPlayAVIFile(char *FileName)
{
	long		frame;
	long		time1, time2, time3;
    MSG			msg;
	double		temp;

	if(OpenVideoFile(FileName)==FALSE) return;

	frame = StartVideoFrame;

	ClearRenderBuffer(0);

	time1 = timeGetTime();
	time2 = time1;
	time3 = 0;

	VideoPlayingFlag = TRUE;

	do
	{
        if(PeekMessage(&msg, NULL, 0, 0, PM_NOREMOVE))
        {
            if (!GetMessage(&msg, NULL, 0, 0)) return;// msg.wParam;
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
		else
		{
	        if(bActive)
		    {
				if(time3 > 0)
				{
					time2 += time3;
					time3 = 0;
				}

				time1 = timeGetTime();
				temp= (frame - StartVideoFrame) * VideoScale * 1000.0 / VideoRate;
				if((time1 - time2) >= (long)temp)
				{
					LoadVideoFrame(frame);
					frame++;
					if(frame >= EndVideoFrame)
					{
						frame = StartVideoFrame;
						time1 = timeGetTime();
						time2 = time1;
						time3 = 0;

						if(lpAudioDataBuffer)
						{
							lpAudioDataBuffer->Stop();
							lpAudioDataBuffer->SetCurrentPosition(0);
							lpAudioDataBuffer->Play(NULL, NULL, 0);
						}
					}

					if(frame <= StartVideoFrame+1)
					{
						if(lpAudioDataBuffer)
							lpAudioDataBuffer->Play(NULL, NULL, 0);
					}
//SetRenderPage(BACKPAGE);
					FilpWholeVideoBuffer();
//SetRenderPage(MAINPAGE);
				}
//AddRipple(rand()%RENDER_WIDTH, rand()%RENDER_HEIGHT, 3,rand()&0x1FF);
//RippleSpread();
//RenderRipple();
				RefreshScreen();
			}
			else
			{
				time3 = timeGetTime() - time1;
			}
		}
	}	while(VideoPlayingFlag);

	CloseVideoFile();
	if(bLive == FALSE)	// program need exit
	{
		DestroyWindow(hWndCopy);
	}

	return;
}



