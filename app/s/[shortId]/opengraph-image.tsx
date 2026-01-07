import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { adminDb } from '@/lib/instant-admin';

export const runtime = 'nodejs';
export const alt = 'Typing Test Result';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// Generate DiceBear Dylan avatar URL (v9.x API)
function getDiceBearAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(seed)}`;
}

interface ShareableResult {
  id: string;
  shortId: string;
  createdAt: number;
  gameResult?: Array<{
    id: string;
    wpm: number;
    accuracy: number;
    duration: number;
    user?: Array<{
      id: string;
      email: string;
    }>;
  }>;
}

export default async function Image({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;

  try {
    const result = await adminDb.query({
      shareableResults: {
        $: {
          where: {
            shortId: shortId,
          },
        },
        gameResult: {
          user: {},
        },
      },
    });

    const shareable = (result.shareableResults as ShareableResult[])?.[0];

    if (!shareable || !shareable.gameResult?.[0]) {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000000',
              color: 'white',
              fontSize: '48px',
            }}
          >
            Result not found
          </div>
        ),
        { ...size }
      );
    }

    const gameResult = shareable.gameResult[0];
    const user = gameResult.user?.[0];

    // Use DiceBear avatar if user exists
    const userAvatar = user ? getDiceBearAvatar(user.id || user.email || 'default') : null;

    const fontData = await readFile(
      join(process.cwd(), 'public/fonts/CursorGothic-Regular.ttf')
    );

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            padding: '60px',
            fontFamily: 'CursorGothic',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <div
              style={{
                fontSize: '120px',
                fontWeight: '400',
                lineHeight: 1,
                letterSpacing: '-4px',
                display: 'flex',
                gap: '20px',
              }}
            >
              <span style={{ color: '#ff6b35', display: 'flex' }}>{gameResult.wpm}</span>
              <span style={{ color: '#6b7280', display: 'flex' }}>WPM</span>
            </div>
            <div
              style={{
                fontSize: '120px',
                fontWeight: '400',
                lineHeight: 1,
                letterSpacing: '-4px',
                display: 'flex',
                gap: '20px',
              }}
            >
              <span style={{ color: '#ff6b35', display: 'flex' }}>{gameResult.accuracy}%</span>
              <span style={{ color: '#6b7280', display: 'flex' }}>ACC</span>
            </div>
          </div>

          {userAvatar && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <img
                src={userAvatar}
                alt="User avatar"
                width="96"
                height="96"
                style={{
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                }}
              />
            </div>
          )}
        </div>
      ),
      {
        ...size,
        fonts: [
          {
            name: 'CursorGothic',
            data: fontData,
            style: 'normal',
            weight: 400,
          },
        ],
      }
    );
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            color: 'white',
            fontSize: '48px',
          }}
        >
          Result not found
        </div>
      ),
      { ...size }
    );
  }
}
