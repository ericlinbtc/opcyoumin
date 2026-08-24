CREATE TABLE "dead_letter_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_job_id" uuid NOT NULL,
	"topic" varchar(80) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(80) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"key" varchar(32) PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_outbox_job_id_outbox_jobs_id_fk" FOREIGN KEY ("outbox_job_id") REFERENCES "public"."outbox_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_topic_idx" ON "dead_letter_jobs" USING btree ("topic","failed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_jobs_idempotency_uq" ON "outbox_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_jobs_pending_idx" ON "outbox_jobs" USING btree ("status","available_at");