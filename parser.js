"use strict";
const sqlstring = require("sqlstring");

var count = function(username, channel, conn, args, bot){
    if(args.length < 1) return "Usage !count <emote>";
    var emote = args[0];
    var emote_is_registered = true;
    var registered_sql = "SELECT `count` FROM " + sqlstring.escapeId(channel) + " WHERE `emote`=" +  sqlstring.escape(emote);
    conn.query(registered_sql, function(error, result){
        if(result[0] == undefined) bot.say("Oof! " + emote + " is not registered as an emote.", channel);
        else bot.say(emote + " has been used " + result[0].count + " times.", channel);
    });
}

module.exports = {
    // Parses a message from IRC and takes the appropriate action(s).
    // @param {String} message - Message to parse.
    // @param {String} user - Author of the message.
    // @param {String} channel - Channel where the message was posted.
    // @param {TwitchBot} bot - The IRC bot.
    // @param {MySQLConnection} conn - The database connection object.
    parse: function(message, channel, user, bot, conn){
        var args = message.split(" ");
        var command = args[0];
        args = args.slice(1);
        switch(command){
            case "!count":
                count(user, channel, conn, args, bot);
                break;
            case "!track":
                break;
            case "!help":
                bot.say("Yikes! There's nothign here, yet.", channel)
            default:
                break;
        }
    }
}

