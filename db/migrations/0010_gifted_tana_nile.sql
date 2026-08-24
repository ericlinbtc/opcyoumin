DROP INDEX "dead_letter_jobs_topic_idx";--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD COLUMN "status" varchar(24) DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD COLUMN "resolution_notes" text;--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activity_creator_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_review_notes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dead_letter_jobs_outbox_uq" ON "dead_letter_jobs" USING btree ("outbox_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_cases_report_uq" ON "moderation_cases" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_topic_idx" ON "dead_letter_jobs" USING btree ("status","topic","failed_at");