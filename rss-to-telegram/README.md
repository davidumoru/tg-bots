# Telegram RSS Bot

This is a simple Telegram bot that lets users subscribe to RSS feeds and get notified when new items are published.

## Features

- `/subscribe <RSS_URL>` - Subscribe to an RSS feed
- `/unsubscribe <RSS_URL>` - Unsubscribe from a feed
- `/list` - List all your subscriptions

The bot checks all subscribed feeds every 5 minutes and sends updates to users when new articles are found.
