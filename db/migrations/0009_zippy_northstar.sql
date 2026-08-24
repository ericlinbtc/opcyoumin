CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid,
	"title" varchar(240) NOT NULL,
	"category" varchar(80) NOT NULL,
	"summary" varchar(1000) NOT NULL,
	"interpretation" text NOT NULL,
	"key_points" text[] DEFAULT '{}' NOT NULL,
	"issuing_authority" varchar(160) NOT NULL,
	"document_number" varchar(80),
	"source_name" varchar(160) NOT NULL,
	"source_url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"effective_at" timestamp with time zone,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "policies_source_url_uq" ON "policies" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "policies_city_status_date_idx" ON "policies" USING btree ("city_id","status","published_at");