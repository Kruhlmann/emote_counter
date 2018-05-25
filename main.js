"use strict";
// Packages
const TwitchBot = require('twitch-bot');
const fs = require("fs");
const request = require("request");
const mysql = require("mysql");
const express = require("express");
const path = require("path");
const sqlstring = require("sqlstring");
const colors = require("colors");
const phantom = require("phantom");

// Local packages
const parser = require("./parser");

// User defined consts
const credentials = require("./credentials");
const bttv_api_path = "https://twitch.center/customapi/bttvemotes?channel=";

// Create express app for serving user interface
var app = express();
// User interface
app.use(express.static("public"));
// User interface API
app.get("/api/channel_exists/:channel", function(req, res){
    var channel = req.params.channel;
    // This css class is used for the image on twitch channel 404 pages. If it is present the channel does not exist or is banned/suspended.
    var magic = "tw-svg__asset tw-svg__asset--deadglitch tw-svg__asset--inherit";
    
    (async function() {
        const instance = await phantom.create();
        const page = await instance.createPage();
        await page.on("onResourceRequested", function(requestData) {
            console.info('Requesting', requestData.url)
        });

        const status = await page.open('https://twitch.tv/' + channel);
        console.log(status);

        const content = await page.property('content');
        console.log(content);
        await instance.exit();
    }());

    request("https://twitch.tv/" + channel, function(error, response, body){
        
        res.json({
            "error": error,
            "status": response.statusCode,
            "channel_exists": !body.includes(magic),
            "body": body
        });
    });
});

// Start express server on port 3000
var server = app.listen(3000, function(){
    console.log("Server started on port 3000");
});

// Establish database connection
var conn = mysql.createConnection({
    host: credentials.host,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
});
conn.connect();

// Simplified function for making database queries, which do not require results
// @param {String} sql - Query string to perform.
// @param {MySQLConnection} conn - The database connection object.
// @param {Boolean} supress - Will supress any MySQL errors if true
var q = function(sql, conn, supress) {
    return conn.query(sql, function(error, results, fields) {
        if (error && !supress) {
            console.log("An error occured with the following SQL query: " + sql);
            throw error;
        }
    });
}

// Register an emote in the emote database and return its assigned id.
// @param {String} key - The emote name.
// @param {Number} type - The emote type.
// @param {MySQLConnection} conn - The database connection object.
// @param {Function} callback - The callback function to call when the query exits.
// @return {int} - The id of the inserted row.
var register_emote = function(key, type, conn, callback){
    var sql = sqlstring.format("INSERT IGNORE INTO `emote_database` (`key`, `type`) VALUES (?, ?); SELECT `id` FROM `emote_database` WHERE `key`=?;", [key, type, key]);
    conn.query(sql, function(error, result, fields){
        if(callback !== undefined) callback(result);
    });
}

// Track a new emote in a channel.
// @param {String} key - The emote name.
// @param {String} channel - The channel where the tracking applies.
// @param {MySQLConnection} - The database connection object.
// @param {Function} callback - Will be called with a message depending on the tracking state.
var track_emote = function(key, channel, conn, callback){
    // Escape input
    channel = sqlstring.escapeId(channel);
    key = sqlstring.escape(key);
    var sql = "SELECT `emote_database`.`id` FROM " + channel + " INNER JOIN `emote_database` ON `emote_database`.`key`=" + channel + ".`emote` WHERE " + channel + ".`emote`=" + key + ";";
    conn.query(sql, function(error, result, fields){
        if(error) throw error;
        // An id present means the emote is being tracked
        if(result[0] != undefined) callback("I'm already tracking " + key + ".");
        else{
            var track_sql = "INSERT IGNORE INTO " + channel + " (`emote`, `count`) VALUES (" + key + ", 1)";
            q(track_sql, conn);
            callback("I started tracking " + key + ".");    
        }
    });
}

// Adds one to the counter of an emote in the database
// If the emote is not present in the database it will be added
// @param {String} key - The identifier of the emote.
// @param {string] channel - The channel to apply the incrementation to.
// @param {MySQLConnection} - The database connection object.
var increment_emote = function(key, channel, conn) {
    var sql = "INSERT INTO `" + channel + "` (`emote`, `count`) VALUES ('" + key + "', 1) ON DUPLICATE KEY UPDATE count = count + 1";
    var res = q(sql, conn);
};

// Starts the bot
// @param {String[]} channels - An array of channels to monitor.
// @param {MySQLConnection} conn - The database connection object.
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
        console.log("Joined channel: " + channel.cyan);
    });

    Bot.on('error', err => {
        console.log(err);
    });

    // Main message handler
    Bot.on('message', chatter => {
        console.log("[" + chatter.channel.cyan + "] " + chatter.username.green + ": " + chatter.message);
        if(chatter.message.startsWith("!")) parser.parse(chatter.message, chatter.channel, chatter.username,  Bot, conn)
        else {
            // If the message is not a command then scan the message for emotes and increment and results.
            var channel_emotes_sql = "SELECT `emote` FROM " + sqlstring.escapeId(chatter.channel) + " WHERE 1";
            conn.query(channel_emotes_sql, function(error, result){
                if(error) throw error;
                for(var i in result){
                    var emote = result[i]["emote"];
                    // The checks here make sure the emote is properly typed, so as not to count false positives.
                    // Every emote must be contained within spaces in the message or at the end/start of the string.
                    if(chatter.message.startsWith(emote + " ") || chatter.message == emote || chatter.message.endsWith(" " + emote) || chatter.message.includes(" " + emote + " ")){
                        increment_emote(emote, chatter.channel, conn);
                    }
                }
            });
        }
    });
}

// Gather tracked channels from the database and start the bot
conn.query("SELECT `name` FROM tracked_channels", function(error, result) {
    if (error) throw error;
    // Starts the bot with channels pulled from database mapped from JSON to array
    var channels = result.map(function(e1){ return e1.name; });
    // Before running the bot, the BTTV channel specific emotes must be loaded.
    for (var channel in channels){
        var url = "https://api.betterttv.net/2/channels/" + channel;

    }
    run_bot(channels, conn);
});
