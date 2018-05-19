"use strict";

var count = function(args){
    if(args.length < 1) return "Usage !count <emote>";

}

module.exports = {
    parse: function(message){
        var args = message.split(" ");
        var command = args[0];
        args = args.slice(1);
        console.log("Command " + command);
        console.log("Args " + args);
    }
}
