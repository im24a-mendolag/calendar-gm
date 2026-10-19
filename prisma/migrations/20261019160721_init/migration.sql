-- CreateEnum
CREATE TYPE "event_kind" AS ENUM ('exam', 'test', 'presentation', 'deadline', 'appointment', 'interview', 'work', 'sport', 'social', 'other');

-- CreateEnum
CREATE TYPE "subject_color" AS ENUM ('blue', 'orange', 'violet', 'teal', 'green', 'amber', 'pink', 'brown');

-- CreateEnum
CREATE TYPE "exception_kind" AS ENUM ('cancelled', 'changed');

-- CreateEnum
CREATE TYPE "event_source" AS ENUM ('manual', 'ics');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Zurich',
    "show_weekends" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" "subject_color" NOT NULL,
    "teacher" TEXT,
    "default_room" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_slots" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "room" TEXT,

    CONSTRAINT "lesson_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_exceptions" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "slot_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" "exception_kind" NOT NULL,
    "new_start_time" TIME(0),
    "new_end_time" TIME(0),
    "new_room" TEXT,
    "note" TEXT,

    CONSTRAINT "lesson_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "event_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "subject_id" UUID,
    "date" DATE NOT NULL,
    "start_time" TIME(0),
    "end_time" TIME(0),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "topics" TEXT,
    "notes" TEXT,
    "reminder_days" SMALLINT,
    "source" "event_source" NOT NULL DEFAULT 'manual',
    "ics_uid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_id" UUID,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "due_date" DATE NOT NULL,
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wake_times" (
    "user_id" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "time" TIME(0),

    CONSTRAINT "wake_times_pkey" PRIMARY KEY ("user_id","weekday")
);

-- CreateTable
CREATE TABLE "wake_time_overrides" (
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TIME(0),

    CONSTRAINT "wake_time_overrides_pkey" PRIMARY KEY ("user_id","date")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "subjects_user_id_idx" ON "subjects"("user_id");

-- CreateIndex
CREATE INDEX "terms_user_id_idx" ON "terms"("user_id");

-- CreateIndex
CREATE INDEX "holidays_user_id_idx" ON "holidays"("user_id");

-- CreateIndex
CREATE INDEX "lesson_slots_user_id_idx" ON "lesson_slots"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_exceptions_slot_id_date_key" ON "lesson_exceptions"("slot_id", "date");

-- CreateIndex
CREATE INDEX "events_user_id_date_idx" ON "events"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "events_user_id_ics_uid_key" ON "events"("user_id", "ics_uid");

-- CreateIndex
CREATE INDEX "homework_user_id_due_date_idx" ON "homework"("user_id", "due_date");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_slots" ADD CONSTRAINT "lesson_slots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_slots" ADD CONSTRAINT "lesson_slots_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_slots" ADD CONSTRAINT "lesson_slots_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exceptions" ADD CONSTRAINT "lesson_exceptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_exceptions" ADD CONSTRAINT "lesson_exceptions_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "lesson_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wake_times" ADD CONSTRAINT "wake_times_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wake_time_overrides" ADD CONSTRAINT "wake_time_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
