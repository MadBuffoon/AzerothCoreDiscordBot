const fs = require('fs');
const logStream = fs.createWriteStream('error.log', { flags: 'a' });

process.on('unhandledRejection', (reason, promise) => {
	logStream.write(`Unhandled Promise Rejection: ${reason}\n`);
});

process.on('uncaughtException', (error) => {
	logStream.write(`Uncaught Exception: ${error.stack}\n`);
});

const Discord = require("discord.js")
const config = require("./config.js")
const client = new Discord.Client();
const tool = require("./Funtions.js")

require('./databasesql.js')(client)
const connection = require('./databasesql.js')
module.exports = client

client.commands = new Discord.Collection();
client.aliases = new Discord.Collection()
client.cooldowns = new Discord.Collection();
client.DMonlies = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);

	if (command.DMonly === true) {
			client.DMonlies.set(command.name, command)
	}
}


// Startup
client.once('ready', () => {
	console.log("----------");
	console.log(`Logged in as ${client.user.tag}!`);
	console.log("----------");

	const updatePresence = async () => {
		let overallStatus = await tool.ServerStatus();
		let uptime;
		let onlineCount;
		if (overallStatus === 'Server Down'){
			uptime = 'N/A';
			onlineCount = 'N/A';
		}
		else{
			uptime = await tool.ServerUpTime(connection);
			onlineCount = await tool.getOnlinePlayersCount(connection);
		}
		let SystemUsage = await tool.getSystemUsage();
		await tool.sendStatusMessage(connection);

		const activityMessage = `${overallStatus} \n| ${config.statusMessage} \n| Online: ${onlineCount} \n| Uptime: ${uptime}\n| SystemUsage: ${SystemUsage}`;

		client.user.setActivity(activityMessage, { type: 'PLAYING' });
	};

	// Initially set the presence
	updatePresence();

	// Set up an interval to update the presence regularly
	setInterval(updatePresence, 10000);
});

// Command Handler

client.on('message', async message => {

	if (!message.content.startsWith(config.prefix) || message.author.bot) return;

	const args = message.content.slice(config.prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();
	const { DMonlies } = client;

	const DMonlyCommand = DMonlies.get(command);

	if(message.guild !== null && DMonlyCommand) return message.reply("This is a DM only command.")
	if(!client.commands.has(command)) return;

	const { cooldowns } = client;

		if (!cooldowns.has(command.name)) {
			cooldowns.set(command.name, new Discord.Collection());
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
		if(client.commands.has(command)) client.commands.get(command).execute(message, args)

		timestamps.set(message.author.id, now);
		setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);	

	} catch (error) {
		console.error(error);
		message.reply('There was an error trying to execute that command!');
	}
});



client.login(config.token)
