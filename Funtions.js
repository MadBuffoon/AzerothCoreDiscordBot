const Discord = require("discord.js")
const config = require("./config.js")
const client = new Discord.Client();
const os = require('os');
const osUtils = require('os-utils');
const fs = require('fs');
const net = require('net');

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
        return 'Error getting server uptime.';
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

            if (results.length > 0) {
                const uptimeInSeconds = results[0].uptime;
                const hours = Math.floor(uptimeInSeconds / 3600);
                const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
                const formattedUptime = `${hours}h ${minutes}m`;

                resolve(formattedUptime);
            } else {
                resolve('0');
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
    let uptime = await ServerUpTime(connection);
    let onlineCount = await getOnlinePlayersCount(connection);
    let SystemUsage = await getSystemUsage();

    if (overallStatus !== lastStatus) {
        lastStatus = overallStatus; // Update lastStatus

        if (botChannel) {
            if (overallStatus === 'Server Down') {
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
                    .setDescription('')
                    .addField('Status', overallStatus, true)
                    .addField('Online', onlineCount, true)
                    .addField('UpTime', uptime, true)
                    .addField('System Usage', SystemUsage, true)
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
}



module.exports = {
    getOnlinePlayersCount,
    ServerStatus,
    ServerUpTime,
    getSystemUsage,
    sendStatusMessage,
    
}