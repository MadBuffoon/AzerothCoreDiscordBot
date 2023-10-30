const Discord = require("discord.js")
const config = require("./config.js")
const client = new Discord.Client();
let previousServerStatus = true;
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

const net = require('net');
const connection = require("./databasesql"); // Make sure to import 'net'
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
            if (previousServerStatus !== true) {
                sendStatusMessage('Server is back up.');
                previousServerStatus = true;
            }
            tcpClient.end(); // Close the connection
            resolve('Server Up');
        });

        tcpClient.on('error', (err) => {
            // Some kind of error prevents us, we'll assume it's inaccessible
            if (previousServerStatus !== false) {
                sendStatusMessage('Server is down.');
                previousServerStatus = false;
            }
            resolve('Server Down');
        });

        tcpClient.on('close', () => {
            // Connection closed
            // You can perform any necessary cleanup here
        });
    });
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Your other code here
});
client.login(config.token);
function sendStatusMessage(message) {

    // Send the status message to the specified channel
    const botChannel = client.channels.cache.get(config.botChannelID);
    if (botChannel) {
        botChannel.send(message)
            .then(() => {
                console.log(`Message sent: ${message}`);
            })
            .catch((error) => {
                console.error(`Error sending message: ${error}`);
            });
    } else {
        console.error(`Bot channel not found: ${config.botChannelID}`);
    }
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
                resolve('No uptime data found.');
            }
        });
    });
}

module.exports = {
    getOnlinePlayersCount,
    ServerStatus,
    ServerUpTime,
    
}