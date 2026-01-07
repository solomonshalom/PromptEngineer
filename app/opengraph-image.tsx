import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { adminDb } from '@/lib/instant-admin';

export const runtime = 'nodejs';
export const alt = 'Leaderboard - Top Scores';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

interface GameResultWithUser {
  id: string;
  wpm: number;
  accuracy: number;
  duration: number;
  createdAt: number;
  user?: Array<{
    id: string;
    email: string;
  }>;
}

async function getTopThreePlayers() {
  try {
    const result = await adminDb.query({
      gameResults: {
        $: {
          order: { createdAt: "desc" },
          limit: 50,
        },
        user: {},
      },
    });

    if (!result.gameResults) {
      return [];
    }

    // Sort by WPM descending and take top 3
    const sortedResults = (result.gameResults as GameResultWithUser[])
      .sort((a, b) => b.wpm - a.wpm)
      .slice(0, 3);

    return sortedResults.map((r) => ({
      wpm: r.wpm,
      accuracy: r.accuracy,
      duration: r.duration,
      playerName: r.user?.[0]?.email?.split("@")[0] || null,
    }));
  } catch (error) {
    console.error("Error fetching top players:", error);
    return [];
  }
}

export default async function Image() {
  const topPlayers = await getTopThreePlayers();

  const player1Name = topPlayers[0]?.playerName || 'Anonymous';
  const player1Stats = `${topPlayers[0]?.accuracy || 0}% accuracy • ${topPlayers[0]?.duration || 0}s`;
  const player1Wpm = String(topPlayers[0]?.wpm || 0);

  const player2Name = topPlayers[1]?.playerName || 'Anonymous';
  const player2Stats = `${topPlayers[1]?.accuracy || 0}% accuracy • ${topPlayers[1]?.duration || 0}s`;
  const player2Wpm = String(topPlayers[1]?.wpm || 0);

  const player3Name = topPlayers[2]?.playerName || 'Anonymous';
  const player3Stats = `${topPlayers[2]?.accuracy || 0}% accuracy • ${topPlayers[2]?.duration || 0}s`;
  const player3Wpm = String(topPlayers[2]?.wpm || 0);

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
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          padding: '60px',
          fontFamily: 'CursorGothic',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            fontWeight: '400',
            lineHeight: 1,
            letterSpacing: '-2px',
            color: '#ff6b35',
            marginBottom: '60px',
          }}
        >
          LEADERBOARD
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '30px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '30px',
              paddingBottom: '30px',
              borderBottom: '1px solid #e2e2df',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
              }}
            >
              <span style={{ fontSize: '48px' }}>🏆</span>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '400',
                  color: '#26251e',
                }}
              >
                {player1Name}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: '#7a7974',
                }}
              >
                {player1Stats}
              </div>
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#26251e',
                fontFeatureSettings: '"tnum"',
              }}
            >
              {player1Wpm}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '30px',
              paddingBottom: '30px',
              borderBottom: '1px solid #e2e2df',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
              }}
            >
              <span style={{ fontSize: '48px' }}>🥈</span>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '400',
                  color: '#26251e',
                }}
              >
                {player2Name}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: '#7a7974',
                }}
              >
                {player2Stats}
              </div>
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#26251e',
                fontFeatureSettings: '"tnum"',
              }}
            >
              {player2Wpm}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '30px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
              }}
            >
              <span style={{ fontSize: '48px' }}>🥉</span>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '400',
                  color: '#26251e',
                }}
              >
                {player3Name}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: '#7a7974',
                }}
              >
                {player3Stats}
              </div>
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#26251e',
                fontFeatureSettings: '"tnum"',
              }}
            >
              {player3Wpm}
            </div>
          </div>
        </div>
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
}
