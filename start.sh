#!/bin/bash

# Download global twitch emotes and TTV emotes
curl -o "global_emotes.json" "https://twitchemotes.com/api_cache/v3/global.json" > /dev/null 2>&1
curl -o "global_bttv_emotes.json" "https://api.betterttv.net/2/emotes/" > /dev/null 2>&1

while [ "$1" != "" ]; do
    PARAM=`echo $1 | awk -F= '{print $1}'`
    VALUE=`echo $1 | awk -F= '{print $2}'`
    case $PARAM in
        -h | --help)
                echo "Usage:"
                echo -e "\t\e[32m--help\e[0m\t\tDisplay this prompt"
                echo -e "\t\e[32m--update-cache\e[0m\tUpdates the emotes for every channel to reflext API changes."
            exit
            ;;
        --update-cache)
                # Extract mysql credentials from credentials.json
                echo "Updating emote database please wait..."
                mysql_password=`grep -o 'password: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                mysql_user=`grep -o 'user: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                mysql_database=`grep -o 'database: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                mysql_host=`grep -o 'host: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                client_id=`grep -o 'client_id: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                client_secret=`grep -o 'client_secret: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                
                # Check if any fields are empty
                if [ -z "$mysql_password" ] || [ -z "$mysql_user" ] || [ -z "$mysql_database" ] || [ -z "$mysql_host" ] || [ -z "$client_id" ] || [ -z "$client_secret" ]
                then
                    echo "error: please fill in the credentials.js file"
                    exit 1
                fi

                # Make sure all tracked channels have tables associated with them.
                channel_sql="CREATE TABLE IF NOT EXISTS \`#$name\` (\`emote\` VARCHAR(255) NOT NULL, \`count\` INT(11) NOT NULL DEFAULT '0', PRIMARY KEY (\`emote\`)) ENGINE = MyISAM;"
                mysql -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "$channel_sql"

                # Download and import FFZ and BTTV emotes from their respective APIs, as well as the global emotes.
                # Quotes ruin the mysql command so all arguments have their double quotes removed.
                mysql -N -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "SELECT \`name\` FROM \`tracked_channels\` WHERE 1" | while read name
                do
                    echo -e "Importing emotes for channel \e[0;36m$name\e[0m"
                    # Check if the channel actually exists

                    # For some reason piping the json data directly into a variable doesn't work. Instead I'm just going to save the file lcoally and then read json from it.
                    curl -o ${name//\"}-meta.json -i -H 'Accept: application/vnd.twitchtv.v3+json' -H 'Client-ID: ${client_id//\"}' 'https://api.twitch.tv/kraken/channels/${name//\"}'
                    error_404=`grep -o '"error": *"[^"]*"' ${name//\"}-meta.json | grep -o '"[^"]*"$'`
                    remote_name=`grep -o '"name": *"[^"]*"' ${name//\"}-meta.json | grep -o '"[^"]*"$'`
                    echo "$error_404"
                    echo "$remote_name"

                    # Global BTTV
                    echo -n -e "\tBTTV global emotes..."
                    global_bttv_emotes=(`grep -o '"code":*"[^"]*"' global_bttv_emotes.json | grep -o '"[^"]*"$'`)
                    for i in "${global_bttv_emotes[@]}"
                    do
                        register_global_bttv_sql="INSERT IGNORE INTO \`#$name\` (\`emote\`, \`count\`) VALUES ('${i//\"}', 0)"
                        mysql -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "$register_global_bttv_sql" > /dev/null 2>&1
                    done
                    echo -e " \e[32mDone\e[0m"
                    
                    # Global
                    echo -n -e "\tTwitch global emotes..."
                    global_emotes=(`grep -o '"code":*"[^"]*"' global_emotes.json | grep -o '"[^"]*"$'`)
                    for i in "${global_emotes[@]}"
                    do
                            register_global_sql="INSERT IGNORE INTO \`#$name\` (\`emote\`, \`count\`) VALUES ('${i//\"}', 0)"
                            mysql -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "$register_global_sql" > /dev/null 2>&1
                    done
                    echo -e " \e[32mDone\e[0m"

                    # BTTV
                    curl -o "$name-bttv.json" "https://api.betterttv.net/2/channels/$name" > /dev/null 2>&1
                    echo -n -e "\tBTTV channel emotes..."
                    # Get an array of all emotes from the file
                    bttv_emotes=(`grep -o '"code": *"[^"]*"' $name-bttv.json | grep -o '"[^"]*"$'`)
                    for i in "${bttv_emotes[@]}"
                    do
                        register_bttv_query="INSERT IGNORE INTO \`#$name\` (\`emote\`, \`count\`) VALUES ('${i//\"}', 0)"
                        mysql -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "$register_bttv_query" > /dev/null 2>&1
                    done
                    # Done with the file, delete it
                    rm "$name-bttv.json"
                    echo -e " \e[32mDone\e[0m"
                    
                    # FFZ
                    curl -o "$name-ffz.json" "https://api.frankerfacez.com/v1/room/$name" > /dev/null 2>&1
                    # Get an array of all emotes from the file and loop through them
                    ffz_emotes=`grep -o '"name": *"[^"]*"' $name-ffz.json | grep -o '"[^"]*"$'`
                    index=0
                    echo -n -e "\tFFZ channel emotes..."
                    for i in ${ffz_emotes[@]}
                    do
                        # The FFZ JSON result comes with two fields using the identifier "name". Each emtoe is associated with two name fields. Therefore we skip every other occurence, since thwy are not valid emotes.
                        if [ $(($index % 2)) == 1 ]
                        then
                            index=$((index+1))
                            continue
                        fi
                        register_ffz_query="INSERT IGNORE INTO \`#$name\` (\`emote\`, \`count\`) VALUES ('${i//\"}', 0)"
                        mysql -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "$register_ffz_query" > /dev/null 2>&1
                        index=$((index+1))
                    done
                    # Done with the file, delete it
                    rm "$name-ffz.json"

                    echo -e " \e[32mDone\e[0m"
                done

                # Clean-up
                rm global_emotes.json
                ;;
            *)
                echo "Error: Unknown param \"$PARAM\""
                exit 1
            esac
            shift
    done
# Start the bot
echo -e "\e[34mStarting Node.JS\e[0m"
node main.js
