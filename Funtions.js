﻿const Discord = require("discord.js")
const config = require("./config.js")
const client = new Discord.Client();
const os = require('os');
const osUtils = require('os-utils');
const fs = require('fs');
const net = require('net');
const connection = require("./databasesql");

async function getOnlinePlayersCount(connection) {
    return new Promise((resolve, reject) => {
        connection.query('USE acore_characters');
        connection.query('SELECT COUNT(*) AS onlineCount FROM characters WHERE online = 1', (error, results1, fields) => {
            if (error) {
                console.error(error);
                reject("An error occurred while fetching online player count.");
            } else {
                const onlineCount = results1[0].onlineCount;
                resolve(onlineCount);
            }
        });
    });
}
async function getOnlinePlayersList(connection) {
    return new Promise((resolve, reject) => {
        const onlinePlayers = [];
        connection.query('USE acore_characters');
        connection.query('SELECT name, level FROM characters WHERE online = 1', (error, results, fields) => {
            if (error) {
                console.error(error);
                reject("An error occurred while fetching online players.");
            } else {
                results.forEach((row) => {
                    const playerInfo = `${row.name} (${row.level})`;
                    onlinePlayers.push(playerInfo);
                });

                if (onlinePlayers.length === 0) {
                    resolve(" "); // Return empty string
                } else {
                    resolve(onlinePlayers);
                }
            }
        });
    });
}



async function ServerStatus() {
    try {
        const status = await checkServerStatus();
        //console.log(`Server status: ${status}`);

        if (status === 'Server Up') {
            return 'Server Up';
        } else {
            return 'Server Down';
        }
    } catch (error) {
        console.error(`Error checking server status: ${error}`);
        return 'Error';
    }
}
function checkServerStatus() {
    return new Promise((resolve, reject) => {
        const host = config.serverURL;
        const port = 8085;
        const tcpClient = new net.Socket();

        tcpClient.connect(port, host, () => {
            // Connected successfully, the server is available
            tcpClient.end(); // Close the connection
            resolve('Server Up');
        });

        tcpClient.on('error', (err) => {
            // Some kind of error prevents us, we'll assume it's inaccessible
            resolve('Server Down');
        });

        tcpClient.on('close', () => {
            // Connection closed
            // You can perform any necessary cleanup here
        });
    });
}
async function ServerUpTime(connection) {
    try {
        return await getServerUptime(connection);
    } catch (error) {
        console.error(error);
        return 'N/A';
    }
}

function getServerUptime(connection) {
    return new Promise((resolve, reject) => {
        connection.query('USE acore_auth');
        connection.query('SELECT realmid, starttime, uptime FROM uptime WHERE realmid = 1 ORDER BY starttime DESC LIMIT 1', (error, results, fields) => {
            if (error) {
                reject(error);
                return;
            }
            try {
                if (results.length > 0) {
                    const uptimeInSeconds = results[0].uptime;
                    const days = Math.floor(uptimeInSeconds / 86400);
                    const hours = Math.floor((uptimeInSeconds % 86400) / 3600);
                    const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
                    const seconds = uptimeInSeconds % 60;

                    const formattedUptime = [];

                    if (days > 0) {
                        formattedUptime.push(`${days}d`);
                    }
                    if (hours > 0) {
                        formattedUptime.push(`${hours}h`);
                    }
                    if (minutes > 0) {
                        formattedUptime.push(`${minutes}m`);
                    }
                    if (seconds > 0 && minutes === 0 && hours === 0 && days === 0) {
                        
                    }

                    resolve(formattedUptime.join(' '));
                } else {
                    resolve('0s');
                }
            }
            catch (error){
                resolve('0s');
            }
        });
    });
}
function getSystemUsage() {
    return new Promise((resolve, reject) => {
        osUtils.cpuUsage(function (cpuUsage) {
            const cpuUsagePercentage = (cpuUsage * 100).toFixed(1);
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsagePercentage = ((usedMemory / totalMemory) * 100).toFixed(1);

            const systemUsageString = `CPU: ${cpuUsagePercentage}%\nRAM: ${memoryUsagePercentage}%`;

            resolve(systemUsageString);
        });
    });
}





// Function to read the last message ID from the JSON file
function readLastMessageID() {
    if (fs.existsSync('SaveData.json')) {
        try {
            const data = fs.readFileSync('SaveData.json');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading last message ID: ${error}`);
            return null;
        }
    } else {
        return null;
    }
}


// Function to save the last message ID to the JSON file
function saveLastMessageID(messageID) {
    try {
        fs.writeFileSync('SaveData.json', JSON.stringify({ lastSentMessageID: messageID }));
    } catch (error) {
        console.error(`Error saving last message ID: ${error}`);
    }
}

const savedData = readLastMessageID();
let lastSentMessageID = savedData ? savedData.lastSentMessageID : null;


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Your other code here
});
client.login(config.token);

let lastStatus = 'Server Up';
async function sendStatusMessage(connection) {
    const botChannel = client.channels.cache.get(config.botChannelID);
    let overallStatus = await ServerStatus();
    let uptime;
    let onlineCount;
    let OnlineList;
    if (overallStatus === 'Server Down'){
        uptime = 'N/A';
        onlineCount = 'N/A';
        OnlineList = 'N/A';
    }
    else{
        uptime = await ServerUpTime(connection);
        onlineCount = await getOnlinePlayersCount(connection);
        OnlineList = await getOnlinePlayersList(connection);
    } 
        
    let SystemUsage = await getSystemUsage();

    if (botChannel) {
        if (overallStatus === 'Server Down' && overallStatus !== lastStatus) {

            lastStatus = overallStatus; // Update lastStatus
            // Delete the message and clear the saved data
            if (lastSentMessageID) {
                botChannel.messages
                    .fetch(lastSentMessageID)
                    .then((message) => {
                        message
                            .delete()
                            .then(() => {
                                lastSentMessageID = null; // Clear the message ID
                                saveLastMessageID(lastSentMessageID);
                                console.log('Status message deleted.');
                            })
                            .catch((error) => {
                                console.error(`Error deleting status message: ${error}`);
                            });
                    })
                    .catch((error) => {
                        console.error(`Error fetching message: ${error}`);
                    });
            }
        } else {
            const embed = new Discord.MessageEmbed()
                .setColor(config.color)
                .setTitle('Public Realm Info')
                .setDescription(`${config.statusMessage2}`)
                .addField('Status', `${overallStatus}`, true)
                .addField('Online', ` ${onlineCount}`, true) // Use ${} for variables
                .addField('UpTime', ` ${uptime}`, true) // Use ${} for variables
                .addField('System Usage', `${SystemUsage}`, true)
                .addField('Online List', `${OnlineList}`, false)
                .setTimestamp()
                .setFooter('Bot Status', client.user.displayAvatarURL());


            if (lastSentMessageID) {
                botChannel.messages
                    .fetch(lastSentMessageID)
                    .then((message) => {
                        message
                            .edit(embed)
                            .then(() => {
                                //console.log('Status message updated.');
                            })
                            .catch((error) => {
                                console.error(`Error updating status message: ${error}`);
                            });
                    })
                    .catch((error) => {
                        console.error(`Error fetching message: ${error}`);
                    });
            } else {
                botChannel.send(embed)
                    .then((message) => {
                        lastSentMessageID = message.id; // Save the message ID
                        saveLastMessageID(lastSentMessageID);
                        console.log('Status message sent.');
                    })
                    .catch((error) => {
                        console.error(`Error sending status message: ${error}`);
                    });
            }
        }
    } else {
        console.error(`Bot channel not found: ${config.botChannelID}`);
    }
}



module.exports = {
    getOnlinePlayersCount,
    ServerStatus,
    ServerUpTime,
    getSystemUsage,
    sendStatusMessage,
    
}