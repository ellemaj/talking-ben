require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('startben').setDescription('Speel een random geluid af'),
  new SlashCommandBuilder().setName('grrr').setDescription('Speel grrr.mp3'),
  new SlashCommandBuilder().setName('hmm').setDescription('Speel hmm.mp3'),
  new SlashCommandBuilder().setName('hohoho').setDescription('Speel hohoho.mp3'),
  new SlashCommandBuilder().setName('no').setDescription('Speel no.mp3'),
  new SlashCommandBuilder().setName('phone').setDescription('Speel phone.mp3'),
  new SlashCommandBuilder().setName('rustle').setDescription('Speel rustle.mp3'),
  new SlashCommandBuilder().setName('yes').setDescription('Speel yes.mp3'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Refreshing application (/) commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.BOT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Successfully reloaded commands!');
  } catch (error) {
    console.error(error);
  }
})();