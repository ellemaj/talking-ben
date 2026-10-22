require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, InteractionContextType } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('callben').setDescription('Ben bellen'),
  new SlashCommandBuilder().setName('grrr').setDescription('grrrr'),
  new SlashCommandBuilder().setName('hmm').setDescription('hmm'),
  new SlashCommandBuilder().setName('hohoho').setDescription('Ho ho ho'),
  new SlashCommandBuilder().setName('no').setDescription('no'),
  new SlashCommandBuilder().setName('phone').setDescription('tring tring'),
  new SlashCommandBuilder().setName('rustle').setDescription('rustle'),
  new SlashCommandBuilder().setName('yes').setDescription('yes'),
  new SlashCommandBuilder().setName('hangup').setDescription('Laat Ben de voice channel verlaten'),
  new SlashCommandBuilder().setName('switch').setDescription('Verplaats Ben naar jouw voice channel'),
].map(cmd => cmd.setContexts(InteractionContextType.Guild).toJSON()); // only usable in servers, not in DMs

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Refreshing global application (/) commands...');
    // Global commands work in every server Ben is in
    await rest.put(Routes.applicationCommands(process.env.BOT_ID), { body: commands });

    // Remove the old server-only commands, otherwise they show up twice in that server
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.BOT_ID, process.env.GUILD_ID), { body: [] });
      console.log('Removed old guild commands');
    }

    console.log('Successfully reloaded commands!');
  } catch (error) {
    console.error(error);
  }
})();
