CREATE TABLE "grocery_item" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"amount" double precision,
	"unit" text DEFAULT '' NOT NULL,
	"aisle" text DEFAULT 'Other' NOT NULL,
	"recipes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grocery_item" ADD CONSTRAINT "grocery_item_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_item_user_key" ON "grocery_item" USING btree ("userId","key");