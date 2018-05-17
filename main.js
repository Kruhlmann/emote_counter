const TwitchBot = require('twitch-bot');
const fs = require("fs");
const request = require("request");
const mysql = require("mysql");
const credentials = require("./credentials");

// Establish database connection
var conn = mysql.createConnection({
    host: credentials.host,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
});
conn.connect();

// Simplified function for making database queries, which do not require results
var q = function(sql, conn, supress) {
    return conn.query(sql, function(error, results, fields) {
        if (error) {
            if (!supress) console.log("An error occured with the following SQL query: " + sql);
            throw error;
        }
    });
}

// Creates a database for a channel
var add_channel = function(channel, conn) {
    var sql = "CREATE TABLE IF NOT EXISTS `gyj5xqc9_emote_counter`.`" + channel + "` (`emote` VARCHAR(255) NOT NULL , `count` INT(11) NOT NULL DEFAULT '0' , PRIMARY KEY (`emote`)) ENGINE = MyISAM;";
    var res = conn.query(sql, function(error, results, fields) {
        if (error) {
            console.log("An error occured with the following SQL query: " + sql);
            throw error;
        }
    })
    for (emote in global_emote_json) {
        q("INSERT IGNORE INTO `" + channel + "` (`emote`, `count`) VALUES ('" + emote + "', 0)", conn, true);
    }
}

// Adds one to the counter of an emote in the database
// If the emote is not present in the database it will be added
var increment_emote = function(key, channel, conn) {
    var sql = "INSERT INTO `" + channel + "` (`emote`, `count`) VALUES ('" + key + "', 1) ON DUPLICATE KEY UPDATE count = count + 1";
    var res = q(sql, conn);
};

// Grab updated global emote data from API
// The result is stored in the global_emotes.json file
// In the future this should be done at an interval, maybe every hour
// That way new emotes are continuesly integrated without needing a restart of the service
var global_emote_url = "https://twitchemotes.com/api_cache/v3/global.json";
var res = request(global_emote_url);
res.on("response", function() {
    res.pipe(fs.createWriteStream("global_emotes.json"));
});
var global_emote_json = JSON.parse(fs.readFileSync("global_emotes.json"));

// Starts the bot
var run_bot = function(channels, conn) {
    // Bot configuration
    // You can get your OAuth token for your Twitch account here:
    // https://twitchapps.com/tmi/
    const Bot = new TwitchBot({
        username: credentials.username,
        oauth: credentials.oauth,
        channels: channels
    });

    Bot.on('join', channel => {
        add_channel(channel, conn);
        console.log(`Joined channel: ${channel}`);
    })

    Bot.on('error', err => {
        console.log(err);
    })

    // Main message handler
    Bot.on('message', chatter => {
        if (chatter.message.startsWith("!count")) {
            var emote = chatter.message.replace("!count", "").replace(/\s/g, '');
            conn.query("SELECT `count` FROM `" + chatter.channel + "` WHERE `emote`='" + emote + "'", function(error, result) {
                if (error) {
                    Bot.say("OOF! I got an error. Maybe " + emote + " isn't an emote?");
                    console.log(error);
                } else {
                    if (result[0] == undefined) Bot.say(emote + " is not registered as an emote.");
                    else Bot.say(emote + " has been used " + result[0].count + " times.");
                }
            });
        } else {
            // Don't increment the emote count if it's used for a !count assesment
            for (emote in global_emote_json) {
                if (chatter.message.includes(emote)) increment_emote(emote, chatter.channel, conn);
            }
        }
    })
}

// Gather tracked channels from the database and start the bot
var channels = conn.query("SELECT `name` FROM tracked_channels", function(error, result) {
    if (error) throw error;
    // Starts the bot with channels pulled from database mapped from JSON to array
    run_bot(result.map(function(el) {
        return el.name;
    }), conn);
});
