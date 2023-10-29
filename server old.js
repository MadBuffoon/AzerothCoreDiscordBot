const fs = require('fs');
const net = require('net'); // Add the 'net' module for TCP client
const Discord = require('discord.js');
const { Client, Collection } = Discord;
const client = new Client();
const config = require('./config.js');
const database = require('./databasesql.js')(client);

const connection = require('./databasesql.js')

const logStream = fs.createWriteStream('error.log', { flags: 'a' });
const executablesToMonitor = ['mysqld.exe', 'authserver.exe', 'worldserver.exe'];
let previousServerStatus = null;

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

client.commands = new Collection();
client.aliases = new Collection();
client.cooldowns = new Collection();
client.DMonlies = new Collection();

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);

  if (command.DMonly === true) {
    client.DMonlies.set(command.name, command);
  }
}

function checkIfExecutableIsRunning(executablesToMonitor) {
  return () => {
  if (notRunningExecutables.length > 0) {
    return `Server Not UP - ${notRunningExecutables.join(', ')}`;
  } else {
    return 'Server is UP';
  }
  };
}

function createServerUptimeManager(connection) {
  return {
    getServerUptime: () => {
      return new Promise((resolve, reject) => {
        connection.query('USE acore_auth');
        connection.query('SELECT realmid, starttime, uptime FROM uptime WHERE realmid = 1 ORDER BY starttime DESC LIMIT 1', (error, results, fields) => {
          if (error) {
            console.error(error);
            reject('An error occurred while fetching server uptime.');
          }

          if (results.length > 0) {
            const latestUptime = results[0];
            const uptimeString = formatUptime(latestUptime);
            resolve(uptimeString);
          } else {
            resolve('No uptime data found.');
          }
        });
      });
    },
    formatUptime: (uptimeData) => {
      // Implement the code to format the uptime
      // Return the formatted uptime string
    },
  };
}

function createOnlinePlayersCounter(connection) {
  return (callback) => {
    connection.query('USE acore_characters');
    connection.query('SELECT COUNT(*) AS onlineCount FROM characters WHERE online = 1', (error, results1, fields) => {
      if (error) {
        console.error(error);
        callback("An error occurred while fetching online player count.");
      } else {
        const onlineCount = results1[0].onlineCount;
        callback(null, onlineCount);
      }
    });
  };
}

function checkServerStatus() {
  try {
    // Create a simple TCP client to ping a port
    const host = config.serverURL;
    const port = 8085;
    const tcpClient = new net.Socket();

    tcpClient.connect(port, host, () => {
      // Connected successfully, the server is available
      if (previousServerStatus !== true) {
        // Server status changed from down to up
        sendStatusMessage('Server is back up.');
        previousServerStatus = true;
      }
      tcpClient.end(); // Close the connection
    });

    tcpClient.on('error', (err) => {
      // Some kind of error prevents us, we'll assume it's inaccessible
      if (previousServerStatus !== false) {
        // Server status changed from up to down
        sendStatusMessage('Server is down.');
        previousServerStatus = false;
      }
    });

    tcpClient.on('close', () => {
      // Connection closed
      // You can perform any necessary cleanup here
    });
  } catch (error) {
    // Handle any exceptions here
    // Some kind of error prevents us, we'll assume it's inaccessible
    if (previousServerStatus !== false) {
      // Server status changed from up to down
      sendStatusMessage('Server is down.');
      previousServerStatus = false;
    }
  }
}

function sendStatusMessage(message) {
  // Send the status message to the specified channel
  const botChannel = client.channels.cache.get(config.botChannelID);
  if (botChannel) {
    botChannel.send(message);
  } else {
    console.error('Bot channel not found.');
  }
}

client.once('ready', () => {
  console.log("----------");
  console.log(`Logged in as ${client.user.tag}!`);
  console.log("----------");

  const updatePresence = async () => {
    const overallStatus = checkIfExecutableIsRunning();
    const uptime = await createServerUptimeManager();
    checkServerStatus();

    getOnlinePlayersCount((error, onlineCount) => {
      if (error) {
        console.error(error);
        onlineCount = 'Error fetching online count';
      }
      const activityMessage = `${overallStatus} \n| ${config.statusMessage} \n| Online: ${onlineCount} \n| Uptime: ${uptime}`;

      client.user.setActivity(activityMessage, { type: 'PLAYING' });
    });
  };

  // Initially set the presence
  updatePresence();

  // Set up an interval to update the presence regularly
  setInterval(updatePresence, 10000);
});

client.on('message', async message => {
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const { DMonlies, commands, cooldowns } = client;
  const DMonlyCommand = DMonlies.get(commandName);
  const command = commands.get(commandName);

  if (message.guild && DMonlyCommand) return message.reply("This is a DM only command.");
  if (!command) return;

  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 3) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before using this command again.`);
    }
  }

  try {
    command.execute(message, args);

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  } catch (error) {
    console.error(error);
    message.reply('There was an error trying to execute that command!');
  }
});

client.login(config.token);
