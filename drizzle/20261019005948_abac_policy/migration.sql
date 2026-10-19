CREATE TABLE "abac_policy" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "abac_policy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"rules" jsonb NOT NULL,
	"effect" text DEFAULT 'allow' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	CONSTRAINT "abac_policy_effect_check" CHECK ("effect" IN ('allow', 'deny'))
);
--> statement-breakpoint
CREATE INDEX "abac_policy_resource_action_priority_idx" ON "abac_policy" ("resource","action","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "abac_policy_slug_idx" ON "abac_policy" ("slug");--> statement-breakpoint
ALTER TABLE "abac_policy" ADD CONSTRAINT "abac_policy_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;