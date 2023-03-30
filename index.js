require("dotenv/config");
const algoliasearch = require("algoliasearch");
const { Client, IntentsBitField, ChannelType, EmbedBuilder } = require("discord.js");

//only allow bot to reply in threads
const validChannelTypes = new Set([ChannelType.PrivateThread, ChannelType.PublicThread]);
const algo = algoliasearch(process.env.ALGO_APP_ID, process.env.ALGO_API_KEY).initIndex("crowdsec");
const client = new Client({
	intents: [
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.GuildMessages,
		IntentsBitField.Flags.MessageContent,
	],
});

client.on("ready", () => {
	console.log("Bot is ready");
});

//listen for messages
// WIP most likely will ditch this and just use the threadCreate event
client.on("messageCreate", (message) => {
	if (message.author.bot) return;
	if (!validChannelTypes.has(message.channel.type)) return;

	if (message.content === "ping") {
		message.reply("pong");
	}
});

client.on("threadCreate", async (thread) => {
	//check if thread is older than 5 minutes as threadCreate is triggered when a user joins a thread
	if (thread.createdAt < Date.now() - 1000 * 60 * 5) return;
	// fetch the last message in the thread
	const message = (await thread.messages.fetch({ limit: 1 })).first();
	// if there is no message, return
	if (!message) return;
	// if the message is from a bot, return
	if (message.author.bot) return;
	// Send message to user that the bot is searching for their question
	thread.send("Hello, I am a bot that will run your thread name through our documentation to see if we can find the best answer.");
	// search algolia for the question
	const results = await cDocsSearch(thread.name);
	// if there are no results, send a message to the user
	if (results.hits.length === 0) {
		thread.send("I could not find any results for your question.");
		return;
	}
	// if there are results, send a message to the user with the results
	const embed = new EmbedBuilder()
		.setTitle("Results")
		.setDescription(results.hits.map(
			({ type, url, hierarchy}) => `[${type === `content` ? url : hierarchy[type]}](${url})`
		).join("\n")).setFooter({
			text: "Powered by Algolia",
		});
	// send the embed to the thread
	thread.send({ embeds: [embed] });
})

const cDocsSearch = async (content, limit = 5) => {
	// search algolia for the question and limit to 5 by default
	return algo.search(content, {
		hitsPerPage: limit,
		facetFilters: ["language:en",["docusaurus_tag:default","docusaurus_tag:docs-default-current"]]
		// this filters out the results that are not in the latest docs
	});
}

client.login(process.env.TOKEN);
