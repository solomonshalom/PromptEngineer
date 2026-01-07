import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { adminDb } from '@/lib/instant-admin';

export const runtime = 'nodejs';
export const alt = 'Score Result';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// Generate DiceBear Dylan avatar URL (v9.x API)
function getDiceBearAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(seed)}`;
}

interface SharedScore {
  id: string;
  shortId: string;
  type: string;
  score: number;
  passed: boolean | null;
  title: string;
  subtitle: string | null;
  createdAt: number;
  user?: Array<{
    id: string;
    email: string;
  }>;
}

// Get score color based on value
function getScoreColor(score: number): string {
  if (score >= 90) return '#22c55e'; // green-500
  if (score >= 70) return '#22c55e'; // green-500
  if (score >= 50) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

export default async function Image({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;

  try {
    const result = await adminDb.query({
      sharedScores: {
        $: {
          where: {
            shortId: shortId,
          },
        },
        user: {},
      },
    });

    const sharedScore = (result.sharedScores as SharedScore[])?.[0];

    if (!sharedScore) {
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
            Score not found
          </div>
        ),
        { ...size }
      );
    }

    const user = sharedScore.user?.[0];
    const userAvatar = user ? getDiceBearAvatar(user.id || user.email || 'default') : null;
    const scoreColor = getScoreColor(sharedScore.score);

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
          {/* Score and Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '20px',
            }}
          >
            {/* Score */}
            <div
              style={{
                fontSize: '140px',
                fontWeight: '400',
                lineHeight: 1,
                letterSpacing: '-4px',
                display: 'flex',
                gap: '10px',
              }}
            >
              <span style={{ color: scoreColor, display: 'flex' }}>{sharedScore.score}</span>
              <span style={{ color: '#6b7280', display: 'flex' }}>/100</span>
            </div>

            {/* Title */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '36px',
                  color: '#1f2937',
                  display: 'flex',
                  maxWidth: '900px',
                }}
              >
                {sharedScore.title}
              </span>
              {sharedScore.subtitle && (
                <span
                  style={{
                    fontSize: '24px',
                    color: '#6b7280',
                    display: 'flex',
                  }}
                >
                  {sharedScore.subtitle}
                </span>
              )}
            </div>
          </div>

          {/* User Avatar */}
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
          Score not found
        </div>
      ),
      { ...size }
    );
  }
}
