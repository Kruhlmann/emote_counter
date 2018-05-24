#!/bin/bash
echo "Updating emote database please wait..."

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
                # extract mysql credentials from credentials.json
                mysql_password=`grep -o 'password: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                mysql_user=`grep -o 'user: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                mysql_database=`grep -o 'database: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                mysql_host=`grep -o 'host: *"[^"]*"' credentials.js | grep -o '"[^"]*"$'`
                # check if any fields are empty
                if [ -z "$mysql_password" ] || [ -z "$mysql_user" ] || [ -z "$mysql_database" ] || [ -z "$mysql_host" ]
                then
                    echo "error: please fill in the credentials.js file"
                    exit 3
                fi

                # Download and import FFZ and BTTV emotes from their respective APIs, as well as the global emotes.
                # Quotes ruin the mysql command so all arguments have their double quotes removed.
                mysql -N -u ${mysql_user//\"} -p${mysql_password//\"} -D ${mysql_database//\"} -h ${mysql_host//\"} -e "SELECT \`name\` FROM \`tracked_channels\` WHERE 1" | while read name
                do
                    echo -e "Importing emotes for channel \e[0;36m$name\e[0m"
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
node main.js
