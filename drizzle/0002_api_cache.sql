CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expiresAt" timestamp NOT NULL
);
