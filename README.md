# Radiance-Comms

Multi-ticket commissions and moderation Discord bot scaffold built with Node.js and discord.js v14.

Features
- Panel-based ticket opening (commissions, support, admin support, partnerships, applications, events)
- Commission modal with estimator and private ticket channel creation
- Staff action buttons (Accept / Reject / Close)
- SQLite storage (local bot-data.db)
- Price estimator (configurable) with conversions to Nitro/Robux

Quick start
1. Clone the repository:
   git clone https://github.com/radiance-comms/Radiance-Comms.git
2. Install dependencies:
   npm install
3. Create a .env file from .env.example and set DISCORD_TOKEN to your bot token (do NOT commit this):
   cp .env.example .env
   # then edit .env and add your DISCORD_TOKEN
4. Start the bot:
   npm start

Notes
- Ensure the bot has the proper intents (Guilds, GuildMessages, MessageContent if needed) and is invited with the applications.commands scope.
- The bot stores data in a local SQLite database (bot-data.db). For production, consider moving to Postgres or a managed DB.
- Do not share your bot token publicly. If it is leaked, rotate it immediately in the Developer Portal.

Contributing
If you want changes (transcripts, staff dashboard, TypeScript conversion), open an issue or request here and I can implement them.
