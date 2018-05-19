#!/bin/bash
echo "Updating emote database please wait..."
# Download global twitch emotes
curl -o "global_emotes.json" "https://twitchemotes.com/api_cache/v3/global.json"

