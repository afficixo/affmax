CREATE TABLE "dashboard_news_posts" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dashboard_news_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dashboard_news_posts_createdAt_idx" ON "dashboard_news_posts"("createdAt");

ALTER TABLE "dashboard_news_posts"
  ADD CONSTRAINT "dashboard_news_posts_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
