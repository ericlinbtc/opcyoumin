CREATE TABLE "help_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160) NOT NULL,
	"category" varchar(80) NOT NULL,
	"question" varchar(240) NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid,
	"author_role" varchar(24) NOT NULL,
	"body" varchar(3000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(24) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
DROP INDEX "organization_applications_org_user_uq";--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "source_name" varchar(160);--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "fact_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD COLUMN "source_name" varchar(160);--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD COLUMN "fact_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "source_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "revision_note" varchar(1000);--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "attendance_marked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "attendance_marked_by" uuid;--> statement-breakpoint
ALTER TABLE "help_ticket_messages" ADD CONSTRAINT "help_ticket_messages_ticket_id_help_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."help_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_ticket_messages" ADD CONSTRAINT "help_ticket_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "help_faqs_slug_uq" ON "help_faqs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "help_faqs_status_sort_idx" ON "help_faqs" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "help_ticket_messages_ticket_idx" ON "help_ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "organization_memberships" USING btree ("user_id","joined_at");--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_attendance_marked_by_users_id_fk" FOREIGN KEY ("attendance_marked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_applications_org_user_idx" ON "organization_applications" USING btree ("organization_id","user_id","created_at");
