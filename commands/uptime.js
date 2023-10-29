const Discord = require("discord.js");
const config = require('../config.js');
const client = require('../server.js');
const crypto = require('crypto');
const connection = require('../databasesql.js');
const soap = require("../soap.js");

module.exports = {
    name: 'uptime',
    description: 'Get the server uptime.',
    DMonly: false,
    execute(message, args) {
        connection.query('USE acore_auth');
        connection.query('SELECT realmid, starttime, uptime FROM uptime WHERE realmid = 1 ORDER BY starttime DESC LIMIT 1', (error, results, fields) => {
            if (error) {
                console.error(error);
                return message.channel.send('An error occurred while fetching server uptime.');
            }

            if (results.length > 0) {
                const latestUptime = results[0];
                const uptimeString = formatUptime(latestUptime);

                const embed = new Discord.MessageEmbed()
                    .setColor(config.color)
                    .setTitle('Server Uptime')
                    .setDescription(`The server has been online for: ${uptimeString}`)
                    .setTimestamp()
                    .setFooter('Uptime command', client.user.displayAvatarURL());

                message.channel.send(embed);
            } else {
                message.channel.send('No uptime data found.');
            }
        });
    },
};

function formatUptime(uptimeData) {
    const uptimeInSeconds = parseInt(uptimeData.uptime);
    const days = Math.floor(uptimeInSeconds / 86400);
    const hours = Math.floor((uptimeInSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
    const seconds = uptimeInSeconds % 60;

    let uptimeString = '';

    if (days > 0) {
        uptimeString += `${days} day${days > 1 ? 's' : ''}, `;
    }

    if (hours > 0) {
        uptimeString += `${hours} hour${hours > 1 ? 's' : ''}, `;
    }

    if (minutes > 0) {
        uptimeString += `${minutes} minute${minutes > 1 ? 's' : ''}, `;
    }

    uptimeString += `${seconds} second${seconds > 1 ? 's' : ''}`;

    return uptimeString;
}
