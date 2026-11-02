# Talking Ben Discord Bot

This repository is filled with code for a working **Talking Ben Discord Bot**. To use this code and make one yourself you need to go to *https://discord.com/developers/applications* and make a application.

Then you need to make a .env file with the following:
- A Discord token
- Your Bot's token
- Guild ID (optional: only used to clean up old server-only commands)

The commands are registered globally, so Ben works in every server he is invited to, and in multiple servers at the same time.

## Run Ben

To host Ben locally you need to use the following commands in your commandline:
`node deploy-commands.js`
`node index.js`

If everything is working as it should, you should get: **Bot is online as *(bot name)***

## Invite Ben to a server

### Invite my Ben

Want to try Ben without hosting him yourself? You can invite my version:

**[Invite Talking Ben](https://discord.com/oauth2/authorize?client_id=1488965314854260806&permissions=4785590003682368&integration_type=0&scope=bot+applications.commands)**

> **Note:** My Ben only runs locally on my laptop, so he is only online when my laptop is on and the bot is running. If he doesn't respond, he's probably offline.

### Invite your own Ben

If you host Ben yourself, use this link and replace `YOUR_BOT_ID` with your bot's ID (the same `BOT_ID` as in your .env). The link never expires, so you can reuse it for every server.

```
https://discord.com/oauth2/authorize?client_id=YOUR_BOT_ID&scope=bot+applications.commands&permissions=281474979875840
```

This gives Ben the permissions he needs: **View Channels**, **Send Messages**, **Embed Links**, **Connect**, **Speak** and **Set Voice Channel Status**.

> **Note:** The link needs both the `bot` and `applications.commands` scopes. If you only use `applications.commands`, Discord says the bot was added, but Ben never actually joins the server and won't show up in the member list.

You need the **Manage Server** permission in a server to invite Ben there.