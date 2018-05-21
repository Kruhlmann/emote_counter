#!/bin/bash
echo "Updating emote database please wait..."
# Download global twitch emotes
curl -o "global_emotes.json" "https://twitchemotes.com/api_cache/v3/global.json"
# Extract MySQL credentials from credentials.json
mysql_password=`grep -o 'password: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
mysql_user=`grep -o 'user: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
mysql_database=`grep -o 'database: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
mysql_host=`grep -o 'host: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
# Check if any fields are empty
if [ -z "$mysql_password" ] || [ -z "$mysql_user" ] || [ -z "$mysql_database" ] || [ -z "$mysql_host" ]
then
    echo "Error: please fill in the credentials.js file"
    exit 3
fi

sudo mysql -u $mysql_user -p"$mysql_password" -D $mysql_database -h 127.0.0.1



# Start the bot
exit 1
node main.js
