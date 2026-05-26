/*  StdSound.H  */

// -------------------------------------
//	Init Code
// -------------------------------------

#include <dsound.h>

// -------------------------------------

LPDIRECTSOUND			lpDirectSound;		// DirectSound object

// -------------------------------------

#define	SOUND_MAX_NUM	256

LPDIRECTSOUNDBUFFER		lpPrimarySoundBuffer;
LPDIRECTSOUNDBUFFER		lpSoundData[SOUND_MAX_NUM];	// Sound Buffer handle

// -------------------------------------

BOOL InitDirectSoundDefault(void)
{
	if(DS_OK == DirectSoundCreate(NULL, &lpDirectSound, NULL))
	{
		// Creation succeeded.
		lpDirectSound->SetCooperativeLevel(hWndCopy, DSSCL_NORMAL);
	    // .
	    // . Place code to access DirectSound object here.
		// .
		return TRUE;
	}
	return FALSE;
}

// -------------------------------------

BOOL InitDSound(void)
{
    DSBUFFERDESC	dsbdesc;
	WAVEFORMATEX	pcmwf;

    // Set up wave format structure.
    memset(&pcmwf, 0, sizeof(WAVEFORMATEX));
    pcmwf.wFormatTag = WAVE_FORMAT_PCM;
    pcmwf.nChannels = 2;
    pcmwf.nSamplesPerSec = 22050;
    pcmwf.nBlockAlign = 4;
    pcmwf.nAvgBytesPerSec = 
        pcmwf.nSamplesPerSec * pcmwf.nBlockAlign;
    pcmwf.wBitsPerSample = 16;
	pcmwf.cbSize = 0;

    // Set up DSBUFFERDESC structure.
    memset(&dsbdesc, 0, sizeof(DSBUFFERDESC)); // Zero it out.
    dsbdesc.dwSize = sizeof(DSBUFFERDESC);
    dsbdesc.dwFlags = DSBCAPS_PRIMARYBUFFER;

    // Buffer size is determined by sound hardware.
    dsbdesc.dwBufferBytes = 0; 
    dsbdesc.lpwfxFormat = NULL; // Must be NULL for primary buffers.

	if(DS_OK == DirectSoundCreate(NULL, &lpDirectSound, NULL))
	{
	    if(DS_OK == lpDirectSound->SetCooperativeLevel(hWndCopy, DSSCL_PRIORITY))
		{
	        if(DS_OK == lpDirectSound->CreateSoundBuffer(&dsbdesc, &lpPrimarySoundBuffer, NULL))
			{
				if(DS_OK == lpPrimarySoundBuffer->SetFormat(&pcmwf))
					return TRUE;
	        }
	    }
	}
	return FALSE;
}

// -------------------------------------

void ReleaseDSound(void)
{
	for(int i=0; i<SOUND_MAX_NUM; i++)
	{
		RELEASE(lpSoundData[i]);
	}

	RELEASE(lpPrimarySoundBuffer);
	RELEASE(lpDirectSound);
}

// -------------------------------------

int CreateDirectSoundBuffer(LPBYTE lpWaveFormat, DWORD BufLen, LPDIRECTSOUNDBUFFER *lplpDsb)
{   
	PCMWAVEFORMAT		pcmwf;
    DSBUFFERDESC		dsbdesc;   
	HRESULT				hres;    

    *lplpDsb = NULL;
	memcpy(&pcmwf, lpWaveFormat, sizeof(PCMWAVEFORMAT));

    memset(&dsbdesc, 0, sizeof(DSBUFFERDESC)); 
    dsbdesc.dwSize = sizeof(DSBUFFERDESC);
    dsbdesc.dwFlags = DSBCAPS_LOCSOFTWARE | DSBCAPS_CTRLVOLUME | DSBCAPS_CTRLPAN;

    dsbdesc.dwBufferBytes = BufLen; 
    dsbdesc.lpwfxFormat = (LPWAVEFORMATEX)&pcmwf;    

    hres = lpDirectSound->CreateSoundBuffer(&dsbdesc, lplpDsb, NULL);
    if(DS_OK == hres) 
	{
        // Succeeded. Valid interface is in *lplpDsb. 
		return TRUE;
    } 

    return FALSE;    
}

// -------------------------------------

int	WriteDirectSoundBuffer(LPDIRECTSOUNDBUFFER lpDsb, DWORD dwOffset, LPBYTE lpbSoundData, DWORD dwSoundBytes)
{
    LPVOID lpvPtr1; 
	DWORD dwBytes1; 
    LPVOID lpvPtr2; 
	DWORD dwBytes2; 
	HRESULT hres;

    hres = lpDsb->Lock(dwOffset, dwSoundBytes, &lpvPtr1, &dwBytes1, &lpvPtr2, &dwBytes2, 0);    

    if(DSERR_BUFFERLOST == hres) 
	{
        lpDsb->Restore();
	    hres = lpDsb->Lock(dwOffset, dwSoundBytes, &lpvPtr1, &dwBytes1, &lpvPtr2, &dwBytes2, 0);    
	}

    if(DS_OK == hres) 
	{
        CopyMemory(lpvPtr1, lpbSoundData, dwBytes1);
        if(NULL != lpvPtr2) 
		{
            CopyMemory(lpvPtr2, lpbSoundData+dwBytes1, dwBytes2);        
		}
        hres = lpDsb->Unlock(lpvPtr1, dwBytes1, lpvPtr2, dwBytes2);        
		if(DS_OK == hres) 
		{
            return TRUE;    
		}
    }
    return FALSE;
}

// -------------------------------------
//	Load RAW Sound File
// -------------------------------------

void LoadRawSndData(int num, LPSTR filename, WORD nChannels, DWORD nSamplesPerSec, WORD  wBitsPerSample)
{
	FILE			*fp;
	DWORD			DataLen;
	WAVEFORMATEX 	WaveFmt;

/*
    WORD  wFormatTag;
	WORD  nChannels; 
    DWORD nSamplesPerSec; 
    DWORD nAvgBytesPerSec;
	WORD  nBlockAlign;   
	WORD  wBitsPerSample; 
	WORD  cbSize;
*/

	if(lpDirectSound == NULL)
	{
		return;
	}

	fp=fopen(filename,"rb");
	if(fp == NULL)
	{
		InitFail("Load Sound File Fail");
		return;
	}
	fseek(fp, 0L, SEEK_END);
	DataLen = ftell(fp);
	fseek(fp, 0L, SEEK_SET);

	WaveFmt.wFormatTag = WAVE_FORMAT_PCM;
	WaveFmt.nChannels = nChannels;
	WaveFmt.nBlockAlign = nChannels * wBitsPerSample / 8;
	WaveFmt.nSamplesPerSec = nSamplesPerSec;
	WaveFmt.nAvgBytesPerSec = nSamplesPerSec * WaveFmt.nBlockAlign;
	WaveFmt.wBitsPerSample = wBitsPerSample;
	WaveFmt.cbSize = 0; 

	if(CreateDirectSoundBuffer((LPBYTE)(&WaveFmt), DataLen, &lpSoundData[num]))
	{
		{
		    LPVOID		lpvPtr1; 
			DWORD		dwBytes1; 
			LPVOID		lpvPtr2; 
			DWORD		dwBytes2; 
			HRESULT		hres;

			hres = lpSoundData[num]->SetCurrentPosition(0);
			hres = lpSoundData[num]->Lock(0, DataLen, &lpvPtr1, &dwBytes1, &lpvPtr2, &dwBytes2, 0);

		    if(DSERR_BUFFERLOST == hres) 
			{
				lpSoundData[num]->Restore();
				hres = lpSoundData[num]->Lock(0, DataLen, &lpvPtr1, &dwBytes1, &lpvPtr2, &dwBytes2, 0);
			}

			if(DS_OK == hres) 
			{
				fread(lpvPtr1, DataLen, 1, fp);
				hres = lpSoundData[num]->Unlock(lpvPtr1, dwBytes1, lpvPtr2, dwBytes2);
			}
		}
	}
	fclose(fp);
}

// -------------------------------------
// -------------------------------------
// -------------------------------------
