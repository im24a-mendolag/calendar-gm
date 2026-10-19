-- AlterTable: optional per-lesson teacher (null = use the subject's teacher)
ALTER TABLE "lesson_slots" ADD COLUMN "teacher" TEXT;
