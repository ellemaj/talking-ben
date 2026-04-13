require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('callben').setDescription('Ben bellen'),
  new SlashCommandBuilder().setName('grrr').setDescription('grrrr'),
  new SlashCommandBuilder().setName('hmm').setDescription('hmm'),
  new SlashCommandBuilder().setName('hohoho').setDescription('Ho ho ho'),
  new SlashCommandBuilder().setName('no').setDescription('no'),
  new SlashCommandBuilder().setName('phone').setDescription('tring tring'),
  new SlashCommandBuilder().setName('rustle').setDescription('rustle'),
  new SlashCommandBuilder().setName('yes').setDescription('yes'),
  new SlashCommandBuilder().setName('leave').setDescription('Laat Ben de voice channel verlaten'),
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