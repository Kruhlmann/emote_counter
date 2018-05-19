#!/bin/bash
echo "Updating emote database please wait..."
# Download global twitch emotes
curl -o "global_emotes.json" "https://twitchemotes.com/api_cache/v3/global.json"
# Add further API requirements here

# Start the bot
node main.js
