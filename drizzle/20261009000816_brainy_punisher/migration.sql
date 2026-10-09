CREATE TABLE "magic_links" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redirect_to" text
);
--> statement-breakpoint
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links" ("expires_at");