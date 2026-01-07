import { adminDb } from "@/lib/instant-admin";
import { Navigation } from "@/components/navigation";
import type { Metadata } from "next";
import Link from "next/link";

// Force dynamic rendering since we need environment variables
export const dynamic = "force-dynamic";

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

async function getSharedScore(shortId: string) {
  try {
    const result = await adminDb.query({
      sharedScores: {
        $: {
          where: {
            shortId,
          },
        },
        user: {},
      },
    });

    const sharedScores = result.sharedScores as SharedScore[] | undefined;
    if (!sharedScores || sharedScores.length === 0) {
      return null;
    }

    const score = sharedScores[0];

    return {
      type: score.type,
      score: score.score,
      passed: score.passed,
      title: score.title,
      subtitle: score.subtitle,
      createdAt: new Date(score.createdAt),
      userName: score.user?.[0]?.email?.split("@")[0] || null,
    };
  } catch (error) {
    console.error("Error fetching shared score:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  const result = await getSharedScore(shortId);

  if (!result) {
    return {
      title: "Score not found",
    };
  }

  const passedText = result.passed ? "Passed" : result.passed === false ? "Keep practicing" : "";
  const description = result.subtitle
    ? `I scored ${result.score}/100 on "${result.title}" in ${result.subtitle}! ${passedText}`
    : `I scored ${result.score}/100 on "${result.title}"! ${passedText}`;

  return {
    title: `${result.score}/100 | ${result.title}`,
    description,
    openGraph: {
      title: `${result.score}/100 | ${result.title}`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${result.score}/100 | ${result.title}`,
      description,
    },
  };
}

export default async function SharedScorePage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const result = await getSharedScore(shortId);

  if (!result) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Score not found</h1>
            <p className="text-muted-foreground">
              This score may have expired or doesn&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determine score color based on value
  const scoreColor =
    result.score >= 90
      ? "text-green-500"
      : result.score >= 70
        ? "text-green-500"
        : result.score >= 50
          ? "text-orange-500"
          : "text-red-500";

  // Determine status message
  const statusMessage =
    result.score >= 90
      ? "Excellent!"
      : result.passed
        ? "Passed!"
        : result.passed === false
          ? "Keep practicing!"
          : "";

  // Determine CTA based on type
  const ctaHref = result.type === "lesson" ? "/learn" : "/";
  const ctaText = result.type === "lesson" ? "Try the lessons" : "Try a challenge";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex flex-col items-start justify-center min-h-screen p-8 max-w-4xl mx-auto">
        {/* Score Display */}
        <div className="flex flex-col items-start mb-8">
          <div className="text-6xl md:text-[120px] font-normal leading-none tracking-tighter mb-4">
            <span className={scoreColor}>{result.score}</span>
            <span className="text-gray-500">/100</span>
          </div>
          {statusMessage && (
            <p className={`text-xl md:text-2xl ${scoreColor}`}>{statusMessage}</p>
          )}
        </div>

        {/* Title and Context */}
        <div className="mb-16">
          <h1 className="text-2xl md:text-4xl text-foreground mb-2">{result.title}</h1>
          {result.subtitle && (
            <p className="text-lg md:text-xl text-muted-foreground">{result.subtitle}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <Link
            href={ctaHref}
            className="text-lg text-orange-500 cursor-pointer hover:text-orange-600 transition-colors uppercase"
          >
            {ctaText}
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
