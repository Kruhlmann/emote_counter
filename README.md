# Emote counter
An emote counter for twitch.tv channels

## Installing
Before installing the bot make sure you have a working and up-to-date version of node and npm. Then fill out the credentials.js file and run the following commands.
```
git clone https://github.com/Kruhlmann/emote_counter
cd emote_counter
npm install
```
## Running
To run the bot on Windows do
```
start.bat
```
On Linux/OSX
```
sudo chmod +x start.sh
./start.sh --update-cache
```
If you want to run the bot without refreshing the emote database run the `start.sh` file omitting the `--update-cache` flag.

## Usage
Once your channel has been added to the tracked channels use the syntax `!count <emote>` in twitch chat to get the number of times the emote has been used while the channel was tracked.
