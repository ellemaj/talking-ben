require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
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
const randomItem = (list) => list[Math.floor(Math.random() * list.length)];

// Possible answers for "/ask" and when Ben is listening
const answers = [
  { file: 'yes.mp3', text: 'Yes.' },
  { file: 'no.mp3', text: 'No.' },
  { file: 'hohoho.mp3', text: 'Ho ho ho!' },
  { file: 'grrr.mp3', text: 'Grrr...' },
];

// Sounds Ben makes while reading his newspaper
const newspaperSounds = ['rustle.mp3', 'hmm.mp3'];

// Auto-leave: hang up when nobody is in the VC anymore
const ALONE_TIMEOUT = 60 * 1000; // 1 minute

// Listening: Ben answers when someone is done talking
const SILENCE_BEFORE_ANSWER = 1200; // ms of silence before Ben thinks you're done talking
const MIN_TALK_TIME = 800; // ms, ignore short sounds like coughs or "uh"
const ANSWER_COOLDOWN = 4000; // ms between two answers

// Newspaper: when it's quiet, Ben reads his newspaper every 45 to 90 seconds
const NEWSPAPER_MIN_WAIT = 45 * 1000;
const NEWSPAPER_EXTRA_WAIT = 45 * 1000; // random extra time, so it doesn't feel like a clock

// How long Ben may take to connect to a VC
const CONNECT_TIMEOUT = 15 * 1000;

// Every server gets its own connection, audio player and timers: guildId -> state
const guilds = new Map();

const getState = (guildId) => {
  let state = guilds.get(guildId);
  if (!state) {
    const player = createAudioPlayer();
    player.on(AudioPlayerStatus.Idle, () => console.log(`[${guildId}] Audio klaar`));
    player.on('error', (err) => console.error(`[${guildId}] Audio error:`, err.message));
    state = {
      connection: null,
      player,
      aloneTimer: null,
      newspaperTimer: null,
      listening: true, // toggle with /listen
      speakers: new Map(), // userId -> { startedAt, lastStoppedAt, timer }
      lastAnswerAt: 0,
    };
    guilds.set(guildId, state);
  }
  return state;
};

const isConnected = (state) =>
  state.connection && state.connection.state.status !== VoiceConnectionStatus.Destroyed;

// Something happened in the VC: wait a while again before reading the newspaper
const scheduleNewspaper = (state) => {
  clearTimeout(state.newspaperTimer);
  state.newspaperTimer = setTimeout(() => {
    if (!isConnected(state)) return;
    if (state.player.state.status === AudioPlayerStatus.Idle) {
      console.log(`[${state.connection.joinConfig.guildId}] Ben reads his newspaper`);
      playSound(state, randomItem(newspaperSounds)); // this also schedules the next one
    } else {
      scheduleNewspaper(state);
    }
  }, NEWSPAPER_MIN_WAIT + Math.random() * NEWSPAPER_EXTRA_WAIT);
};

const playSound = (state, file) => {
  state.player.play(createAudioResource(path.join(soundsDir, file)));
  scheduleNewspaper(state);
};

const clearTimers = (state) => {
  clearTimeout(state.aloneTimer);
  clearTimeout(state.newspaperTimer);
  state.aloneTimer = null;
  state.newspaperTimer = null;
  state.speakers.forEach(speaker => clearTimeout(speaker.timer));
  state.speakers.clear();
};

// Play hangup.mp3 and leave the VC when it's done
const hangUp = (state) => {
  const connection = state.connection;
  if (!connection) return;
  playSound(state, 'hangup.mp3');
  state.player.once(AudioPlayerStatus.Idle, () => {
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  });
};

// Check if Ben can join and talk in a channel. Returns an error message, or null if it's fine.
const checkVoiceChannel = (channel) => {
  const me = channel.guild.members.me;
  const permissions = channel.permissionsFor(me);

  if (channel.type === ChannelType.GuildStageVoice) {
    return `Ik werk niet in stage channels zoals **${channel.name}**, probeer een gewone voice channel!`;
  }
  if (!permissions.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.Connect)) {
    return `Ik mag niet in **${channel.name}** komen. Geef mij de permissie **Connect** voor dit kanaal.`;
  }
  if (!permissions.has(PermissionFlagsBits.Speak)) {
    return `Ik mag niet praten in **${channel.name}**. Geef mij de permissie **Speak** voor dit kanaal.`;
  }
  if (channel.full && !permissions.has(PermissionFlagsBits.MoveMembers)) {
    return `**${channel.name}** zit vol! Er past niemand meer bij.`;
  }
  return null;
};

// Someone stopped talking long enough: Ben answers with a random sound
const answerSpeaker = (state, guild, userId) => {
  const speaker = state.speakers.get(userId);
  state.speakers.delete(userId);
  if (!speaker || !state.listening || !isConnected(state)) return;

  const talkTime = speaker.lastStoppedAt - speaker.startedAt;
  if (talkTime < MIN_TALK_TIME) return;
  if (Date.now() - state.lastAnswerAt < ANSWER_COOLDOWN) return;
  if (state.player.state.status !== AudioPlayerStatus.Idle) return; // Ben is already talking

  const answer = randomItem(answers);
  state.lastAnswerAt = Date.now();
  playSound(state, answer.file);
  console.log(`[${guild.name}] Heard someone talk for ${talkTime}ms -> ${answer.file}`);
};

// Track who is talking, so Ben knows when someone is done
const listenTo = (state, connection, guild) => {
  const speaking = connection.receiver.speaking;

  speaking.on('start', (userId) => {
    if (guild.members.cache.get(userId)?.user.bot) return;
    scheduleNewspaper(state); // someone is talking, so it's not quiet

    const speaker = state.speakers.get(userId);
    if (speaker) {
      // Just a short pause, still the same sentence
      clearTimeout(speaker.timer);
    } else {
      state.speakers.set(userId, { startedAt: Date.now(), lastStoppedAt: Date.now(), timer: null });
    }
  });

  speaking.on('end', (userId) => {
    const speaker = state.speakers.get(userId);
    if (!speaker) return;
    speaker.lastStoppedAt = Date.now();
    speaker.timer = setTimeout(() => answerSpeaker(state, guild, userId), SILENCE_BEFORE_ANSWER);
  });
};

// Join (or move to) a voice channel
const connectTo = (state, channel) => {
  // joinVoiceChannel reuses an existing connection in the same server and moves it
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: !state.listening, // Ben needs to hear people to answer them
  });

  if (connection !== state.connection) {
    listenTo(state, connection, channel.guild);

    // Forget the connection when it gets destroyed (e.g. /hangup or Ben is kicked)
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (state.connection === connection) {
        state.connection = null;
        clearTimers(state);
      }
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
    // Give up if Ben can't connect at all, instead of hanging half-connected
    entersState(connection, VoiceConnectionStatus.Ready, CONNECT_TIMEOUT).catch(() => {
      console.error(`[${channel.guild.name}] Could not connect to ${channel.name} within ${CONNECT_TIMEOUT / 1000}s`);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    });
  }

  connection.subscribe(state.player);
  state.connection = connection;
};

// Text for /benhelp
const helpEmbed = new EmbedBuilder()
  .setColor(0x8b5a2b)
  .setTitle('📞 Talking Ben')
  .setDescription('Bel Ben en stel hem je vragen. Hij antwoordt altijd eerlijk... toch?')
  .addFields(
    {
      name: '📞 Bellen',
      value: [
        '`/callben` Ben komt in jouw voice channel',
        '`/hangup` Ben hangt op',
        '`/switch` Ben verhuist naar jouw voice channel',
      ].join('\n'),
    },
    {
      name: '❓ Vragen',
      value: [
        '`/ask` Stel Ben een vraag, hij antwoordt met yes, no, ho ho ho of grrr',
        '`/listen` Zet aan of uit of Ben antwoordt als je praat',
      ].join('\n'),
    },
    {
      name: '🔊 Geluiden',
      value: '`/yes` `/no` `/hohoho` `/grrr` `/hmm` `/phone` `/rustle`',
    },
    {
      name: '📰 Vanzelf',
      value: [
        'Is het een tijdje stil, dan leest Ben zijn krant.',
        `Zit Ben alleen in de voice channel, dan hangt hij na ${ALONE_TIMEOUT / 1000} seconden op.`,
      ].join('\n'),
    },
  );

// READY EVENT
client.once(Events.ClientReady, () => {
  console.log(`Bot is online als ${client.user.tag}`);
});

// VOICE STATE UPDATE: someone joined, left or moved in a VC
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const guild = newState.guild;
  const state = guilds.get(guild.id);
  if (!state || !isConnected(state)) return;

  const benChannel = guild.members.me?.voice.channel;
  if (!benChannel) return;

  const humans = benChannel.members.filter(member => !member.user.bot).size;
  if (humans === 0 && !state.aloneTimer) {
    // Ben is alone, give people a moment to come back
    console.log(`[${guild.name}] Ben is alone, hanging up in ${ALONE_TIMEOUT / 1000}s`);
    state.aloneTimer = setTimeout(() => {
      console.log(`[${guild.name}] Nobody came back, leaving`);
      state.connection?.destroy();
    }, ALONE_TIMEOUT);
  } else if (humans > 0 && state.aloneTimer) {
    // Someone is back, cancel leaving
    clearTimeout(state.aloneTimer);
    state.aloneTimer = null;
  }
});

// INTERACTION CREATE
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (!interaction.inCachedGuild()) {
      return await interaction.reply({ content: 'Ben werkt alleen in een server!', ephemeral: true });
    }
    console.log(`[${interaction.guild.name}] Command received: ${interaction.commandName}`);
    await handleCommand(interaction);
  } catch (err) {
    // Something unexpected went wrong: tell the user instead of crashing the bot
    console.error(`Error in /${interaction.commandName}:`, err);
    const message = { content: 'Er ging iets mis, probeer het nog een keer!', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(message);
      else await interaction.reply(message);
    } catch {
      // The interaction expired, nothing we can do
    }
  }
});

const handleCommand = async (interaction) => {
  const state = getState(interaction.guildId);
  const userChannel = interaction.member.voice.channel;

  // Show all commands with "/benhelp"
  if (interaction.commandName === 'benhelp') {
    return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }

  // Leave the VC when the command "/hangup" is given
  if (interaction.commandName === 'hangup') {
    if (!isConnected(state)) {
      return interaction.reply({ content: 'Ik zit niet in een VC!', ephemeral: true });
    }
    hangUp(state);
    console.log(`[${interaction.guild.name}] Leaving...`);
    return interaction.reply({ content: 'Bye bye!', ephemeral: true });
  }

  // Turn listening on or off with "/listen"
  if (interaction.commandName === 'listen') {
    state.listening = interaction.options.getBoolean('aan', true);
    console.log(`[${interaction.guild.name}] Listening: ${state.listening}`);

    // Show it in Discord: Ben is deafened when he isn't listening
    if (isConnected(state)) {
      state.connection.rejoin({ ...state.connection.joinConfig, selfDeaf: !state.listening });
    }
    return interaction.reply({
      content: state.listening ? 'Ben luistert weer mee 👂' : 'Ben luistert niet meer mee 🙉',
      ephemeral: true,
    });
  }

  if (!userChannel) {
    return interaction.reply({ content: 'Je moet in een voice channel zitten!', ephemeral: true });
  }

  // Ben has to join or move: first check if he's allowed to
  const needsToJoin = !isConnected(state) || interaction.commandName === 'switch';
  if (needsToJoin) {
    const problem = checkVoiceChannel(userChannel);
    if (problem) return interaction.reply({ content: problem, ephemeral: true });
  }

  // Move Ben to the VC of the user with "/switch"
  if (interaction.commandName === 'switch') {
    if (!isConnected(state)) {
      return interaction.reply({ content: 'Ik zit niet in een VC! Gebruik eerst /callben.', ephemeral: true });
    }
    if (state.connection.joinConfig.channelId === userChannel.id) {
      return interaction.reply({ content: 'Ik zit al in jouw VC!', ephemeral: true });
    }

    connectTo(state, userChannel);
    playSound(state, 'ben.mp3');
    console.log(`[${interaction.guild.name}] Switched to VC: ${userChannel.name}`);
    return interaction.reply({ content: `Switched naar ${userChannel.name}`, ephemeral: true });
  }

  // Ask Ben a question with "/ask", he answers with a random sound
  if (interaction.commandName === 'ask') {
    const question = interaction.options.getString('vraag', true);
    const answer = randomItem(answers);

    if (!isConnected(state)) {
      // Ben picks up first, then answers when ben.mp3 is done
      connectTo(state, userChannel);
      playSound(state, 'ben.mp3');
      state.player.once(AudioPlayerStatus.Idle, () => {
        if (isConnected(state)) playSound(state, answer.file);
      });
    } else {
      playSound(state, answer.file);
    }
    console.log(`[${interaction.guild.name}] Ask: "${question}" -> ${answer.file}`);

    // Public reply so everyone can see the question and answer
    return interaction.reply({
      content: `🗣️ **${interaction.member.displayName}:** ${question}\n📞 **Ben:** ${answer.text}`,
      allowedMentions: { parse: [] }, // don't ping anyone mentioned in the question
    });
  }

  let soundFile;
  if (interaction.commandName === 'callben') {
    soundFile = randomItem(sounds);
  } else if (sounds.includes(`${interaction.commandName}.mp3`)) {
    soundFile = `${interaction.commandName}.mp3`;
  } else {
    return interaction.reply({ content: 'Dit command ken ik niet!', ephemeral: true });
  }

  // Join the VC if not connected already, and play ben.mp3 at join
  if (!isConnected(state)) {
    connectTo(state, userChannel);
    playSound(state, 'ben.mp3');
    console.log(`[${interaction.guild.name}] Joined VC: ${userChannel.name}`);
    return interaction.reply({ content: 'Joined VC', ephemeral: true });
  }

  // Ben is in VC -> play the given sound
  playSound(state, soundFile);
  console.log(`[${interaction.guild.name}] Playing sound: ${soundFile}`);
  return interaction.reply({ content: `Playing: ${soundFile}`, ephemeral: true });
};

// Log errors instead of crashing the bot
client.on(Events.Error, (err) => console.error('Discord client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled error:', err));

client.login(process.env.DISCORD_TOKEN);
