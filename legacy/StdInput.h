/*  StdInput.H  */

#define DIRECTINPUT_VERSION         0x0300

#include <dinput.h>

#include "KEYDEF.H"

#define DINPUT_BUFFERSIZE       64      // Number of buffer elements

// -------------------------------------

LPDIRECTINPUT			lpDirectInput;	// DirectInput object
LPDIRECTINPUTDEVICE		lpKeyboard;		// DirectInput device
LPDIRECTINPUTDEVICE		lpMouse; 		// DirectInput device

// -------------------------------------
//		Global Data
// -------------------------------------

BYTE    KEYSTATUSFLAG[256];
BYTE    KEYBUFFER[DINPUT_BUFFERSIZE];
long	KEYSTARTCOUNTER = 0, KEYENDCOUNTER = 0;

UINT	uTimerID = NULL;

int		MOUSEFLAG = FALSE;

BYTE    MOUSEBUFFER[DINPUT_BUFFERSIZE];
long	MOUSESTARTCOUNTER = 0, MOUSEENDCOUNTER = 0;

long	MOUSEX = RENDER_WIDTH - 1;
long	MOUSEY = RENDER_HEIGHT - 1;

long	MouseButton0 = 0;
long	MouseButton1 = 0;
long	MouseButton2 = 0;
long	MouseButton3 = 0;

// -------------------------------------

void ReleaseDInput(void) 
{ 
	if(uTimerID != NULL)
	{
		timeKillEvent(uTimerID);
		uTimerID = NULL;
	}

    if (lpDirectInput) 
    { 
        if(lpKeyboard) 
        { 
            // Always unacquire the device before calling Release(). 
            lpKeyboard->Unacquire(); 
            lpKeyboard->Release();
            lpKeyboard = NULL; 
        }
		if(lpMouse)
		{
            lpMouse->Unacquire(); 
            lpMouse->Release();
            lpMouse = NULL; 
		}
        lpDirectInput->Release();
        lpDirectInput = NULL; 
    } 
} 

// -------------------------------------

void ResetKeyBuffer(void)
{
	KEYSTARTCOUNTER = 0; KEYENDCOUNTER = 0;
}

// -------------------------------------

BYTE GetKey(void)
{
	BYTE	res;

	if(KEYSTARTCOUNTER == KEYENDCOUNTER) return 0;

	res = KEYBUFFER[KEYSTARTCOUNTER];
	KEYSTARTCOUNTER ++;
	if(KEYSTARTCOUNTER >= DINPUT_BUFFERSIZE) KEYSTARTCOUNTER = 0;

	return res;
}

// -------------------------------------

void KeyboardFunc(void)
{
	// get keyboard data
    if(lpKeyboard)
	{
		DIDEVICEOBJECTDATA	rgod[DINPUT_BUFFERSIZE];	// Receives buffered data 
		DWORD				cod;
		HRESULT				hr; 
 
    again:;
		cod = DINPUT_BUFFERSIZE;
		hr = lpKeyboard->GetDeviceData(sizeof(DIDEVICEOBJECTDATA), rgod, &cod, 0);
		if(hr != DI_OK)			// We got an error or we got DI_BUFFEROVERFLOW
		{
			int		i;
			for(i=0; i<256; i++) KEYSTATUSFLAG[i] = 0;

            if(hr == DIERR_INPUTLOST)
			{
                hr = lpKeyboard->Acquire();
				if FAILED(hr)
				{
//					InitFail("Keyboard Acquire failed");
					return;
				}
				if SUCCEEDED(hr)
				{
                    goto again;
                }
            }
        }

        if(SUCCEEDED(hr) && cod > 0)
		{
            DWORD	iod;

            for(iod=0; iod<cod; iod++)
			{
				if((rgod[iod].dwData & 0x80))
				{
					KEYBUFFER[KEYENDCOUNTER] = (BYTE)(rgod[iod].dwOfs);
					KEYENDCOUNTER ++;
					if(KEYENDCOUNTER >= DINPUT_BUFFERSIZE) KEYENDCOUNTER = 0;
				}
                KEYSTATUSFLAG[rgod[iod].dwOfs] = (BYTE)(rgod[iod].dwData & 0x80);
            }
        }
    }
}

// -------------------------------------

void CALLBACK TimeFunc(UINT uTimerID, UINT uMsg, DWORD dwUser, DWORD dw1, DWORD dw2)
{
	if(!bActive || !bLive) return;
	
	// get mouse data
	while (TRUE)
	{
		DIDEVICEOBJECTDATA	data;
		DWORD				elements=1;
		HRESULT hr = lpMouse->GetDeviceData(sizeof(data), &data, &elements, 0);

	    if FAILED(hr)
		{
			if(hr == DIERR_INPUTLOST)
			{
				hr = lpMouse->Acquire();
				if FAILED(hr)
				{
//					InitFail("Mouse Acquire failed");
					return;
				}
			}
		}
		else
		if(elements == 1)
		{
			switch(data.dwOfs)
			{
				case DIMOFS_X:
				MOUSEX+=data.dwData;
				break;
				case DIMOFS_Y: 
				MOUSEY+=data.dwData;
				break;
				case DIMOFS_BUTTON0: 
				MouseButton0=data.dwData;
				break;
				case DIMOFS_BUTTON1: 
				MouseButton1=data.dwData;
				break;
				case DIMOFS_BUTTON2: 
				MouseButton2=data.dwData;
				break;
				case DIMOFS_BUTTON3: 
				MouseButton3=data.dwData;
				break;
			}
		}
		else if (elements==0) break;
	}

	if(MOUSEX < 0) MOUSEX = 0;
	if(MOUSEY < 0) MOUSEY = 0;
	if(MOUSEX >= RENDER_WIDTH) MOUSEX = RENDER_WIDTH - 1;
	if(MOUSEY >= RENDER_HEIGHT) MOUSEY = RENDER_HEIGHT - 1;
}

// -------------------------------------

BOOL InitDInput(void)
{ 
    HRESULT hr;
 
    // Create the DirectInput object
    hr = DirectInputCreate(hInstanceCopy, DIRECTINPUT_VERSION,
                           &lpDirectInput, NULL);

    if FAILED(hr)
	{
		// Create the DirectInput object failed
		return FALSE;
	}

	/*  MOUSE  */
	hr = lpDirectInput->CreateDevice(GUID_SysMouse, &lpMouse, NULL);
	if (FAILED(hr))
	{
		// CreateDevice(Mouse) failed
		return FALSE;
	}

	hr = lpMouse->SetDataFormat(&c_dfDIMouse);
	if (FAILED(hr))
	{
		// SetDataFormat(Mouse) failed
		return FALSE;
	}

	hr = lpMouse->SetCooperativeLevel(hWndCopy,
               DISCL_EXCLUSIVE | DISCL_FOREGROUND);
	if (FAILED(hr))
	{
		// Set mouse cooperative level failed
		return FALSE;
	}
 
	DIPROPDWORD property;
	property.diph.dwSize=sizeof(DIPROPDWORD);
	property.diph.dwHeaderSize=sizeof(DIPROPHEADER);
	property.diph.dwObj=0;
	property.diph.dwHow=DIPH_DEVICE;
	property.dwData=64;

	hr = lpMouse->SetProperty(DIPROP_BUFFERSIZE, &property.diph);
	if (FAILED(hr))
	{
		// Set mouse property failed
		return FALSE;
	}

    hr = lpMouse->Acquire(); 
    if FAILED(hr) 
    { 
		// Get access to mouse failed
		return FALSE;
    } 

	/*  KEYBOARD  */
    hr = lpDirectInput->CreateDevice(GUID_SysKeyboard, &lpKeyboard, NULL);
    if FAILED(hr)
    {
		// CreateDevice(Keyboard) failed
		return FALSE;
    }
 
    hr = lpKeyboard->SetDataFormat(&c_dfDIKeyboard); 
    if FAILED(hr) 
    { 
		// SetDataFormat(Keyboard) failed
		return FALSE;
    } 
 
    hr = lpKeyboard->SetCooperativeLevel(hWndCopy, DISCL_NONEXCLUSIVE | DISCL_FOREGROUND);
    if FAILED(hr) 
    { 
		// Set keyboard cooperative level failed
		return FALSE;
    } 
 
	property.diph.dwSize=sizeof(DIPROPDWORD);
	property.diph.dwHeaderSize=sizeof(DIPROPHEADER);
	property.diph.dwObj=0;
	property.diph.dwHow=DIPH_DEVICE;
	property.dwData=DINPUT_BUFFERSIZE;

	hr = lpKeyboard->SetProperty(DIPROP_BUFFERSIZE, &property.diph);

    if FAILED(hr)
	{
		// Set buffer size failed
        return FALSE;
    }

    hr = lpKeyboard->Acquire(); 
    if FAILED(hr)
    { 
		// Get access to keyboard failed
		return FALSE;
    } 
 
	if((uTimerID = timeSetEvent(10, 0, TimeFunc, (DWORD)0, TIME_PERIODIC)) == NULL)
	{
		InitFail("Set timer Fail");		// Set Timer for DInput
		return FALSE;
	}

    return TRUE; 
} 

// -------------------------------------
//	Mouse Graphics Code
// -------------------------------------

LPDWORD		MouseImageBuffer = NULL;
LPDWORD		MouseImageBackBuffer = NULL;

long	MOUSEATTACHX = 0;
long	MOUSEATTACHY = 0;

// -------------------------------------

#define SetMouseAttachX(X)		MOUSEATTACHX = (X)
#define SetMouseAttachY(Y)		MOUSEATTACHY = (Y)

#define MouseOn()		MOUSEFLAG = TRUE
#define MouseOff()		MOUSEFLAG = FALSE

// -------------------------------------

void SetMouseImage(LPDWORD Image)
{
	long	Width, Height;

	if(Image == NULL) return;

	Width = *(Image);
	Height = *(Image + 1);

	if(Width<=0 || Height<=0) return;

	// Set Image pointer
	MouseImageBuffer = Image;

	// Get memory for back image
	FreeImageBuffer(MouseImageBackBuffer);
	MouseImageBackBuffer = AllocImageBuffer(Width, Height);
}

// -------------------------------------
