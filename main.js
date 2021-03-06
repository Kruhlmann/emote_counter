"use strict";
// NPM packages
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
const credentials = require("./credentials");

// Create express app for serving user interface
var app = express();

// Validates whether a Twitch channel exists
// @param {String} channel - Name of the channel to validate
// @param {Function} cbx - Callback to call. Will be passed (error, status, channel_exists) as parameters
var channel_exists = function (channel, cbk){
    // Request options
    var options = {
        url: "https://api.twitch.tv/kraken/channels/" + channel,
        headers: {
            "Client-ID": credentials.client_id
        }
    };
    // Request data from Twitch API
    request(options, function(error, response, body){
        // Once request finishes call the supplied callback function.
        cbk ({
            "error": error,
            "status": response.statusCode,
            "channel_exists": (!error && response.statusCode == 200)
        });
    });
}

// User interface static content.
app.use(express.static("public"));


// Start express server on port 3000
var server = app.listen(3000, function(){
    console.log("Server started on port 3000".underline.red);
});

// Establish database connection
var conn = mysql.createConnection({
    host: credentials.host,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
});
conn.connect();


// User interface API.

// Responds to requests about channel existance.
// @param {String} channel - The channel to check existance for.
app.get("/api/channel_exists/:channel", function(req, res){
    // Pipe the JSON result into res.json when request completes
    // It's not possible to use res.json as the callback as the app var is not in that scope
    channel_exists(req.params.channel, function(result){
        res.json(result);
    });
});

// Responds to requests to register a Twitch channel.
// @param {String} channel - The name of the channel to register.
app.get("/api/channel/register/:channel", function(req, res){
    // Firstly, check if the channel is a valid twitch channel.
    channel_exists(req.params.channel, function(result){
        if(result.channel_exists == true){
            // Determine if channel is already being tracked
            // TODO: sqlescape
            conn.query("SELECT * FROM tracked_channels WHERE name='" + req.params.channel + "'", function(error, result, fields){
                // Error: SQL error.
                // TODO: User should not see sql errors
                if(error) res.json({error: error, success: false});
                else {
                    // Error: Channel already registered.
                    if(result.length > 0) res.json({error: "Channel " + req.params.channel + " is already registered.", success: false});
                    else {
                        // TODO: sqlescape
                        conn.query("INSERT INTO tracked_channels (name) VALUES ('" + req.params.channel + "')", function(_error, _result, _fields){
                            // Error: SQL error.
                            // TODO: Users should not see sql errors.
                            if(_error) res.json({error: _error, success: false});
                            else res.json({error: "", success: true});
                        });
                    }
                }
            });
        }else{
            res.json({error: req.params.channel + " is not a valid Twitch channel.", success: false});
        }
    });
});

// Simplified function for making database queries, which do not require results
// @param {String} sql - Query string to perform.
// @param {MySQLConnection} conn - The database connection object.
// @param {Boolean} supress - Will supress any MySQL errors if true
var q = function(sql, conn, supress) {
    return conn.query(sql, function(error, results, fields) {
        if (error && !supress) {
            console.log("An error occured with the following SQL query: " + sql);
            return {error: error, result: undefined};
        }
        return {error: undefined, result: results}
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
