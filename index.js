require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;

const soundsDir = path.join(__dirname, 'sounds');
const sounds = fs.readdirSync(soundsDir).filter(f => f.endsWith('.mp3'));
const getRandomSound = () => sounds[Math.floor(Math.random() * sounds.length)];

const player = createAudioPlayer();
let connection;

client.once('clientReady', () => {
  console.log(`Bot is online als ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  let soundFile;
  if (interaction.commandName === 'startben') soundFile = getRandomSound();
  else if (sounds.includes(`${interaction.commandName}.mp3`)) soundFile = `${interaction.commandName}.mp3`;
  else return;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

    if (!connection || connection.state.status === 'destroyed') {
      connection = joinVoiceChannel({
        channelId: VOICE_CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: guild.voiceAdapterCreator,
      });
      connection.subscribe(player);
      console.log('Bot joined voice channel');
    }

    const resource = createAudioResource(path.join(soundsDir, soundFile));
    player.play(resource);

    await interaction.reply({ content: `Playing: ${soundFile}`, ephemeral: true });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Er is een fout opgetreden!', ephemeral: true });
  }
});

player.on(AudioPlayerStatus.Idle, () => console.log('Audio klaar'));

client.login(process.env.DISCORD_TOKEN);