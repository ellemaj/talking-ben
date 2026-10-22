require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const soundsDir = path.join(__dirname, 'sounds');
const sounds = fs.readdirSync(soundsDir).filter(f => f.endsWith('.mp3'));
const getRandomSound = () => sounds[Math.floor(Math.random() * sounds.length)];
const playSound = (player, file) => player.play(createAudioResource(path.join(soundsDir, file)));

// Every server gets its own connection and audio player: guildId -> { connection, player }
const guilds = new Map();

const getPlayer = (guildId) => {
  let state = guilds.get(guildId);
  if (!state) {
    const player = createAudioPlayer();
    player.on(AudioPlayerStatus.Idle, () => console.log(`[${guildId}] Audio klaar`));
    player.on('error', (err) => console.error(`[${guildId}] Audio error:`, err));
    state = { connection: null, player };
    guilds.set(guildId, state);
  }
  return state;
};

const isConnected = (state) =>
  state.connection && state.connection.state.status !== VoiceConnectionStatus.Destroyed;

// Join (or move to) a voice channel
const connectTo = (state, channel) => {
  // joinVoiceChannel reuses an existing connection in the same server and moves it
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  if (connection !== state.connection) {
    // Forget the connection when it gets destroyed (e.g. /hangup or Ben is kicked)
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (state.connection === connection) state.connection = null;
    });
    // A short disconnect also happens when someone drags Ben to another channel,
    // so only give up if he doesn't reconnect within 5 seconds
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      }
    });
  }

  connection.subscribe(state.player);
  state.connection = connection;
};

// READY EVENT
client.once(Events.ClientReady, () => {
  console.log(`Bot is online als ${client.user.tag}`);
});

// INTERACTION CREATE
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inCachedGuild()) {
    return interaction.reply({ content: 'Ben werkt alleen in een server!', ephemeral: true });
  }
  console.log(`[${interaction.guild.name}] Command received: ${interaction.commandName}`);

  const state = getPlayer(interaction.guildId);
  const userChannel = interaction.member.voice.channel;

  // Leave the VC when the command "/hangup" is given
  if (interaction.commandName === 'hangup') {
    if (!isConnected(state)) {
      return interaction.reply({ content: 'Ik zit niet in een VC!', ephemeral: true });
    }

    const connection = state.connection;
    try {
      // play the leave sound and leave when it's done
      playSound(state.player, 'hangup.mp3');
      console.log(`[${interaction.guild.name}] Leaving...`);

      state.player.once(AudioPlayerStatus.Idle, () => {
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
        console.log(`[${interaction.guild.name}] Left voice channel`);
      });

      return interaction.reply({ content: 'Bye bye!', ephemeral: true });
    } catch (err) {
      console.error(err);
      connection.destroy();
      return interaction.reply({ content: 'Jullie zijn té gezellig om op te hangen, probeer het nog een keer!', ephemeral: true });
    }
  }

  if (!userChannel) {
    return interaction.reply({ content: 'Je moet in een voice channel zitten!', ephemeral: true });
  }

  // Move Ben to the VC of the user with "/switch"
  if (interaction.commandName === 'switch') {
    if (!isConnected(state)) {
      return interaction.reply({ content: 'Ik zit niet in een VC! Gebruik eerst /callben.', ephemeral: true });
    }
    if (state.connection.joinConfig.channelId === userChannel.id) {
      return interaction.reply({ content: 'Ik zit al in jouw VC!', ephemeral: true });
    }

    try {
      connectTo(state, userChannel);
      playSound(state.player, 'ben.mp3');
      console.log(`[${interaction.guild.name}] Switched to VC: ${userChannel.name}`);
      return interaction.reply({ content: `Switched naar ${userChannel.name}`, ephemeral: true });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: 'Switchen is mislukt, probeer het nog een keer!', ephemeral: true });
    }
  }

  let soundFile;
  if (interaction.commandName === 'callben') {
    soundFile = getRandomSound();
  } else if (sounds.includes(`${interaction.commandName}.mp3`)) {
    soundFile = `${interaction.commandName}.mp3`;
  } else {
    return;
  }

  try {
    // Join the VC if not connected already, and play ben.mp3 at join
    if (!isConnected(state)) {
      connectTo(state, userChannel);
      playSound(state.player, 'ben.mp3');
      console.log(`[${interaction.guild.name}] Joined VC: ${userChannel.name}`);
      return interaction.reply({ content: 'Joined VC', ephemeral: true });
    }

    // Ben is in VC -> play the given sound
    playSound(state.player, soundFile);
    console.log(`[${interaction.guild.name}] Playing sound: ${soundFile}`);
    await interaction.reply({ content: `Playing: ${soundFile}`, ephemeral: true });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Er is een fout opgetreden!', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
