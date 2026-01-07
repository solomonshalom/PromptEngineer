import { notFound } from "next/navigation";
import { getLesson, getNextLesson } from "@/lib/lessons/content";
import { LessonClient } from "./lesson-client";

interface LessonPageProps {
  params: Promise<{
    moduleSlug: string;
    lessonSlug: string;
  }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { moduleSlug, lessonSlug } = await params;
  const lesson = getLesson(moduleSlug, lessonSlug);

  if (!lesson) {
    notFound();
  }

  const nextLesson = getNextLesson(moduleSlug, lessonSlug);

  return (
    <LessonClient
      lesson={lesson}
      moduleSlug={moduleSlug}
      nextLesson={nextLesson ? {
        moduleSlug: nextLesson.moduleSlug,
        slug: nextLesson.slug,
        title: nextLesson.title,
      } : null}
    />
  );
}
