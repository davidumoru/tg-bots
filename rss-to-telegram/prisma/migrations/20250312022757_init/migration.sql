-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "lastChecked" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
