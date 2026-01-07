"use client";

import { copy } from "clipboard";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { shareGameResult } from "@/app/actions/share";

interface GameResult {
  wpm: number;
  accuracy: number;
  duration: number;
}

interface ResultsViewProps {
  result: GameResult;
  onRestart: () => void;
}

export function ResultsView({ result, onRestart }: ResultsViewProps) {
  const handleShare = async () => {
    const id = nanoid(8);

    // Optimistically copy to clipboard and show success
    const shareUrl = `${window.location.origin}/s/${id}`;
    await copy(shareUrl);
    toast.success("Link copied to clipboard!");

    // Save to database in the background
    try {
      await shareGameResult({
        shortId: id,
        wpm: result.wpm,
        accuracy: result.accuracy,
        duration: result.duration,
      });
    } catch {
      toast.error("Failed to save results");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-xlarge font-bold mb-12">Results</h1>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="bg-card text-card-foreground rounded-lg p-8">
            <div className="text-xxlarge font-bold mb-2">{result.wpm}</div>
            <div className="text-medium text-muted-foreground">WPM</div>
          </div>
          <div className="bg-card text-card-foreground rounded-lg p-8">
            <div className="text-xxlarge font-bold mb-2">{result.accuracy}%</div>
            <div className="text-medium text-muted-foreground">Accuracy</div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={handleShare}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            aria-label="Share your typing test results"
          >
            Share
          </button>
          <button
            onClick={onRestart}
            className="px-8 py-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-accent transition-colors"
            aria-label="Restart typing test"
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}

