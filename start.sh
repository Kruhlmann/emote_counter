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

# Download and improt FFZ and BTTV emotes from their respective APIs
# Quotes ruin the mysql command so all variables have their double quotes removed.
mysql -N -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "SELECT \`name\` FROM \`tracked_channels\` WHERE 1" | while read name
do
    # BTTV
    curl -o "$name-bttv.json" "https://api.betterttv.net/2/channels/$name"
    # Get an array of all emotes from the file
    bttv_emotes=(`grep -o '"code": *"[^"]*"' $name-bttv.json | grep -o '"[^"]*"$'`)
    for i in "${bttv_emotes[@]}"
    do
        register_bttv_query="INSERT IGNORE INTO \`#$name\` (\`emote\`, \`count\`) VALUES ('${i//\"}', 0)"
        mysql -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "$register_bttv_query"
    done
    # Done with the file, delete it
    rm "$name-bttv.json"

    # FFZ
    curl -o "$name-ffz.json" "https://api.frankerfacez.com/v1/room/$name"
    # Get an array of all emotes from the file and loop through them
    ffz_emotes=`grep -o '"name": *"[^"]*"' $name-ffz.json | grep -o '"[^"]*"$'`
    index=0
    for i in ${ffz_emotes[@]}
    do
        # The FFZ JSON result comes with two fields using the identifier "name". Each emtoe is associated with two name fields. Therefore we skip every other occurence, since thwy are not valid emotes.
        if [ $(($index % 2)) == 1 ]
        then
            index=$((index+1))
            continue
        fi
        register_ffz_query="INSERT IGNORE INTO \`#$name\` (\`emote\`, \`count\`) VALUES ('${i//\"}', 0)"
        mysql -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "$register_ffz_query"
        index=$((index+1))
    done
    # Done with the file, delete it
    rm "$name-ffz.json"
done



# Start the bot
exit 1
node main.js
