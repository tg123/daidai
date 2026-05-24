/*  StdStr.H  */

// -------------------------------------

long StrLen(char *Str)
{	//	·µ»Ø×Ö·û´®³¤¶È
	long i=0;

	while(*(Str+i)) i++;
	return i;
}

// -------------------------------------

long StrLenEx(char *Str)
{	//	·µ»Ø×Ö·û´®³¤¶È£¨²»º¬¿ØÖÆ×Ö·û£©
	long	i=0, t=0;
	BYTE	c;

	while(*(Str+i))
	{
		c=*(Str+i);
		if(c=='\n') return t;
		i++;
		if(c>31) t++;
	}
	return t;
}

// -------------------------------------

