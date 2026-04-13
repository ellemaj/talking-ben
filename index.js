require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const soundsDir = path.join(__dirname, 'sounds');
const sounds = fs.readdirSync(soundsDir).filter(f => f.endsWith('.mp3'));
const getRandomSound = () => sounds[Math.floor(Math.random() * sounds.length)];

const player = createAudioPlayer();
let connection = null;

// READY EVENT
client.once(Events.ClientReady, () => {
  console.log(`Bot is online als ${client.user.tag}`);
});

// INTERACTION CREATE
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  console.log(`Command received: ${interaction.commandName}`);

  const userChannel = interaction.member.voice.channel;

  // Leave the VC when the command "/leave" is given
  if (interaction.commandName === 'leave') {
  if (connection) {
    try {
      // play the leave sound
      const leaveSound = createAudioResource(path.join(soundsDir, 'hangup.mp3'));
      player.play(leaveSound);

      console.log('Leaving...');

      // wait till hangup.mp3 is done
      player.once(AudioPlayerStatus.Idle, () => {
        connection.destroy();
        connection = null;
        console.log('Left voice channel');
      });

      return interaction.reply({ content: 'Bye bye!', ephemeral: true });

    } catch (err) {
      console.error(err);
      connection.destroy();
      connection = null;
      return interaction.reply({ content: 'Jullie zijn té gezellig om op te hangen, probeer het nog een keer!', ephemeral: true });
    }
  } else {
    return interaction.reply({ content: 'Ik zit niet in een VC!', ephemeral: true });
  }
}

  if (!userChannel) {
    return interaction.reply({
      content: 'Je moet in een voice channel zitten!',
      ephemeral: true
    });
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
    // Join the VC if not connected already
    if (!connection || connection.state.status === 'destroyed') {
      connection = joinVoiceChannel({
        channelId: userChannel.id,
        guildId: userChannel.guild.id,
        adapterCreator: userChannel.guild.voiceAdapterCreator,
      });
      connection.subscribe(player);

      // Play ben.mp3 at join
      const phone = createAudioResource(path.join(soundsDir, 'ben.mp3'));
      player.play(phone);
      console.log('Joined VC');

      // Returns a reply on the given command
      return interaction.reply({
        content: 'Joined VC',
        ephemeral: true
      });
    }

    // Ben is in VC -> play the given sound
    const resource = createAudioResource(path.join(soundsDir, soundFile));
    player.play(resource);
    console.log(`Playing sound: ${soundFile}`);

    // Reply on the given command
    await interaction.reply({
      content: `Playing: ${soundFile}`,
      ephemeral: true
    });

    // Reply on the given command if an error occured
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: 'Er is een fout opgetreden!',
      ephemeral: true
    });
  }
});

// AUDIO PLAYER STATUS
player.on(AudioPlayerStatus.Idle, () => {
  console.log('Audio klaar');
});

client.login(process.env.DISCORD_TOKEN);