import "dotenv/config";
import { Telegraf } from "telegraf";
import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

// Initialize Prisma and the RSS parser
const prisma = new PrismaClient();
const parser = new Parser();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

bot.start(async (ctx) => {
  await ctx.reply(
    "Welcome to the RSS Bot!\nYou can subscribe to an RSS feed using:\n/subscribe <RSS_URL>\nTo list your subscriptions use /list and to unsubscribe use /unsubscribe <RSS_URL>"
  );
});

// /subscribe command: Subscribe to an RSS feed
bot.command("subscribe", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  if (parts.length < 2) {
    await ctx.reply("Usage: /subscribe <RSS_URL>");
    return;
  }
  const feedUrl = parts[1].trim();
  const chatId = ctx.chat.id.toString();

  const existing = await prisma.subscription.findFirst({
    where: { chatId, feedUrl },
  });
  if (existing) {
    await ctx.reply("You're already subscribed to this feed.");
    return;
  }
  await prisma.subscription.create({
    data: { chatId, feedUrl, lastChecked: new Date() },
  });
  await ctx.reply(`Subscribed to ${feedUrl}`);
});

// /list command: List all subscriptions for this chat
bot.command("list", async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const subs = await prisma.subscription.findMany({ where: { chatId } });
  if (subs.length === 0) {
    await ctx.reply("You have no subscriptions.");
    return;
  }
  let message = "Your subscriptions:\n";
  subs.forEach((sub, idx) => {
    message += `${idx + 1}. ${sub.feedUrl}\n`;
  });
  await ctx.reply(message);
});

// /unsubscribe command: Remove a subscription
bot.command("unsubscribe", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  if (parts.length < 2) {
    await ctx.reply("Usage: /unsubscribe <RSS_URL>");
    return;
  }
  const feedUrl = parts[1].trim();
  const chatId = ctx.chat.id.toString();

  const deleted = await prisma.subscription.deleteMany({
    where: { chatId, feedUrl },
  });
  if (deleted.count > 0) {
    await ctx.reply(`Unsubscribed from ${feedUrl}`);
  } else {
    await ctx.reply(`You are not subscribed to ${feedUrl}`);
  }
});

// Polling function to check RSS feeds for new items
async function pollFeeds() {
  console.log("Polling feeds...");

  const subscriptions = await prisma.subscription.findMany();
  const feedsMap: Record<
    string,
    Array<{ chatId: string; lastChecked: Date; id: number }>
  > = {};

  subscriptions.forEach((sub) => {
    if (!feedsMap[sub.feedUrl]) {
      feedsMap[sub.feedUrl] = [];
    }
    feedsMap[sub.feedUrl].push({
      chatId: sub.chatId,
      lastChecked: sub.lastChecked || new Date(0),
      id: sub.id,
    });
  });

  for (const feedUrl of Object.keys(feedsMap)) {
    try {
      const feed = await parser.parseURL(feedUrl);
      // For each subscription for this feed
      for (const sub of feedsMap[feedUrl]) {
        // Find new items based on publication date
        const newItems = (feed.items || []).filter((item) => {
          if (!item.pubDate) return false;
          const pubDate = new Date(item.pubDate);
          return pubDate > sub.lastChecked;
        });

        if (newItems.length > 0) {
          for (const item of newItems) {
            const message = `New article: ${item.title}\n${item.link}`;
            await bot.telegram.sendMessage(sub.chatId, message);
          }
          const latestDate = newItems.reduce((prev, item) => {
            const pubDate = new Date(item.pubDate!);
            return pubDate > prev ? pubDate : prev;
          }, sub.lastChecked);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { lastChecked: latestDate },
          });
        }
      }
    } catch (error) {
      console.error(`Error polling feed ${feedUrl}:`, error);
    }
  }
}

// Schedule the polling to run every 5 minutes (300000 ms)
setInterval(pollFeeds, 5 * 60 * 1000);

// Start the bot
bot.launch().then(() => {
  console.log("Bot started");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
