ALTER TABLE "help_tickets" ADD COLUMN "request_ip_hash" varchar(64);--> statement-breakpoint
CREATE INDEX "help_tickets_ip_created_idx" ON "help_tickets" USING btree ("request_ip_hash","created_at");