CREATE TYPE "public"."application_status" AS ENUM('submitted', 'reviewing', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "help_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"requester_name" varchar(80) NOT NULL,
	"contact" varchar(160) NOT NULL,
	"description" varchar(3000) NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assignee_id" uuid,
	"resolution" varchar(2000),
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opc_verification_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"city_name" varchar(80) NOT NULL,
	"contact" varchar(120) NOT NULL,
	"real_name" varchar(80) NOT NULL,
	"id_number_hash" varchar(64) NOT NULL,
	"id_number_last4" varchar(4) NOT NULL,
	"idea" varchar(2000) NOT NULL,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"reviewer_id" uuid,
	"review_notes" varchar(1000),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"motivation" varchar(1000),
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"reviewer_id" uuid,
	"review_notes" varchar(1000),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(80) NOT NULL,
	"summary" varchar(500) NOT NULL,
	"location" varchar(240) NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opc_verification_applications" ADD CONSTRAINT "opc_verification_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opc_verification_applications" ADD CONSTRAINT "opc_verification_applications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_applications" ADD CONSTRAINT "organization_applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_applications" ADD CONSTRAINT "organization_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_applications" ADD CONSTRAINT "organization_applications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "help_tickets_status_idx" ON "help_tickets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "help_tickets_user_idx" ON "help_tickets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "opc_verification_applications_status_idx" ON "opc_verification_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "opc_verification_applications_user_idx" ON "opc_verification_applications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_applications_org_user_uq" ON "organization_applications" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_applications_status_idx" ON "organization_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "organization_applications_user_idx" ON "organization_applications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_city_name_uq" ON "organizations" USING btree ("city_id","name");--> statement-breakpoint
CREATE INDEX "organizations_city_status_idx" ON "organizations" USING btree ("city_id","status");