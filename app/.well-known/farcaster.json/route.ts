import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    accountAssociation: {
      // TODO: Generate proper domain ownership signature
      // For now, using placeholder - this will need to be signed properly
      header: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ',
      payload: 'eyJkb21haW4iOiJjYXN0LXByZWRpY3QudmVyY2VsLmFwcCJ9',
      signature: 'placeholder_signature',
    },
    miniapp: {
      name: 'Moon or Doom',
      buttonTitle: 'Open Moon or Doom',
      homeUrl: 'https://cast-predict.vercel.app/miniapp',
      iconUrl: 'https://cast-predict.vercel.app/icon.svg',
      splashImageUrl: 'https://cast-predict.vercel.app/api/og',
      splashBackgroundColor: '#000000',
    },
  };

  return NextResponse.json(manifest);
}
