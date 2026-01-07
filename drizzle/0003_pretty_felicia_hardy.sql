ALTER TABLE "gameResults" DROP CONSTRAINT "wpm_check";--> statement-breakpoint
ALTER TABLE "gameResults" ADD CONSTRAINT "wpm_check" CHECK ("gameResults"."wpm" >= 0 AND "gameResults"."wpm" <= 350);