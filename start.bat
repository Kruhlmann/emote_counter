@echo off
echo "Updating emote database please wait..."
rem Download global twitch emotes
call bitsadmin.exe /transfer "EmoteDatabaseUpdate" "https://twitchemotes.com/api_cache/v3/global.json" "%cd%\global.json"

