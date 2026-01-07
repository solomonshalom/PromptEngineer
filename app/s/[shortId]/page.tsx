import { adminDb } from "@/lib/instant-admin";
import { Navigation } from "@/components/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { WPMChartWrapper } from "@/components/wpm-chart-wrapper";

// Force dynamic rendering since we need environment variables
export const dynamic = "force-dynamic";

interface ShareableResult {
  id: string;
  shortId: string;
  createdAt: number;
  gameResult?: Array<{
    id: string;
    wpm: number;
    accuracy: number;
    duration: number;
    createdAt: number;
    wpmHistory?: Array<{ time: number; wpm: number }> | null;
    user?: Array<{
      id: string;
      email: string;
    }>;
  }>;
}

async function getSharedResult(shortId: string) {
  try {
    const result = await adminDb.query({
      shareableResults: {
        $: {
          where: {
            shortId,
          },
        },
        gameResult: {
          user: {},
        },
      },
    });

    const shareableResults = result.shareableResults as
      | ShareableResult[]
      | undefined;
    if (!shareableResults || shareableResults.length === 0) {
      return null;
    }

    const shareable = shareableResults[0];
    const gameResult = shareable.gameResult?.[0];

    if (!gameResult) {
      return null;
    }

    return {
      wpm: gameResult.wpm,
      accuracy: gameResult.accuracy,
      duration: gameResult.duration,
      createdAt: new Date(gameResult.createdAt),
      wpmHistory: gameResult.wpmHistory || null,
      userName: gameResult.user?.[0]?.email?.split("@")[0] || null,
    };
  } catch (error) {
    console.error("Error fetching shared result:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  const result = await getSharedResult(shortId);

  if (!result) {
    return {
      title: "Result not found",
    };
  }

  return {
    title: `${result.wpm} WPM | ${result.accuracy}% Accuracy`,
    description: `Check out this typing test result: ${result.wpm} WPM with ${result.accuracy}% accuracy`,
    openGraph: {
      title: `${result.wpm} WPM | ${result.accuracy}% Accuracy`,
      description: `Check out this typing test result: ${result.wpm} WPM with ${result.accuracy}% accuracy`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${result.wpm} WPM | ${result.accuracy}% Accuracy`,
      description: `Check out this typing test result: ${result.wpm} WPM with ${result.accuracy}% accuracy`,
    },
  };
}

export default async function SharedResultPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const result = await getSharedResult(shortId);

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Result not found</h1>
            <p className="text-muted-foreground">
              This result may have expired or doesn&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex flex-col items-start justify-center min-h-screen p-8 max-w-4xl mx-auto">
        <div className="flex flex-col items-start mb-16">
          <div className="text-6xl md:text-[120px] font-normal leading-none tracking-tighter mb-4">
            <span className="text-orange-500">{result.wpm}</span>
            <span className="text-gray-500"> WPM</span>
          </div>
          <div className="text-6xl md:text-[120px] font-normal leading-none tracking-tighter">
            <span className="text-orange-500">{result.accuracy}%</span>
            <span className="text-gray-500"> ACC</span>
          </div>
        </div>

        {result.wpmHistory && result.wpmHistory.length > 0 && (
          <div className="w-full mb-8 mt-8">
            <WPMChartWrapper data={result.wpmHistory} />
          </div>
        )}

        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <Link
            href="/"
            className="text-lg text-orange-500 cursor-pointer hover:text-orange-600 transition-colors uppercase"
          >
            Play again
          </Link>
          <span className="text-lg text-gray-400 uppercase">
            Shared on {result.createdAt.toLocaleDateString()}
            {result.userName && ` by ${result.userName}`}
          </span>
        </div>
      </div>
    </div>
  );
}
