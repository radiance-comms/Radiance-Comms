require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const db = require('./db');
const { estimateOrder } = require('./utils/estimator');

db.init();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;
const ADMIN_ONLY_ROLE_ID = process.env.ADMIN_ONLY_ROLE_ID || null;
const EVENTS_ROLE_ID = process.env.EVENTS_ROLE_ID || null;
const PARTNER_MANAGER_ROLE_ID = process.env.PARTNER_MANAGER_ROLE_ID || null;
const CLIENTS_ROLE_ID = process.env.CLIENTS_ROLE_ID || null; // can open all tickets
const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID || null; // limited to support/admin

const CATEGORY_MAP = {
  commission: process.env.COMMISSION_CATEGORY_ID,
  support: process.env.SUPPORT_CATEGORY_ID,
  admin: process.env.SUPPORT_CATEGORY_ID,
  partnership: process.env.PARTNERSHIP_CATEGORY_ID,
  application: process.env.APPLICATION_CATEGORY_ID,
  event: process.env.SUPPORT_CATEGORY_ID
};

const PANEL_CHANNELS = {
  commission: process.env.COMMISSION_PANEL_ID,
  generic: process.env.GENERIC_TICKET_PANEL_ID,
  application: process.env.APPLICATION_PANEL_ID
};

// Map ticket type -> manager role. Include admin role so admins always have access to admin tickets.
const MANAGER_ROLE_BY_TYPE = {
  partnership: PARTNER_MANAGER_ROLE_ID,
  event: EVENTS_ROLE_ID,
  admin: ADMIN_ONLY_ROLE_ID
};

function buildPanelButtons_forCommission() {
  const embed = new EmbedBuilder()
    .setTitle('𓍢ִ໋ ✧˚ HOW TO ORDER & INFORMATION')
    .setDescription(
`╭・welcome to radiance comms✦\nThank you for considering Radiance Comms! We create dream Discord communities, custom server setups, and tailor-made bots to make your server shine in whatever style you choose. 🌈✨🌸\n\n┊・explore our services 💧\nBefore opening a ticket, make sure to browse through our server channels to check out our offerings, pricing, and policies:\n\n- **💐 Prices & Services:** Visit [Menu & Prices](https://discord.com/channels/1560366921105277071/1560512501941145691) to view our Starter, Growth, and Kingdom Bundles, custom bot options, and aesthetic server revamps!\n- **📜 Terms of Service:** Read [TOS](https://discord.com/channels/1560366921105277071/1560512735643566170) to review our payment, deposit, refund, and turnaround policies before placing an order.\n- **✨ Showcase & Portfolio:** Head to [Portfolio](https://discord.com/channels/1560366921105277071/1560815146044100668) to see examples of our past work and designs!\n\n┊・ordering process 🌿\n- **🌱 Step 1 — Review Our Menu:** Check [Menu & Prices](https://discord.com/channels/1560366921105277071/1560512501941145691) to decide what package or custom service fits your needs.\n- **🌸 Step 2 — Open a Ticket:** Click the ticket button on the panel below in this channel to start your commission request!\n- **💫 Step 3 — Share Your Vision:** In your ticket, send your server theme, color preferences, bot requirements, or any inspiration images you have!\n- **🌾 Step 4 — Deposit & Quote:** We will calculate an exact quote for you. Work begins once the 50% deposit via **Cash App** is confirmed!\n\n╰・ready to begin? 🌸\nClick the panel button below to open your ticket today! We can't wait to bring your server vision to life! ☁️✨`
    )
    .setColor('#FFB6C1')
    .setFooter({ text: 'Radiance Comms • How to Order' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:commission').setLabel('Open Commission').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function buildPanelButtons_generic() {
  const embed = new EmbedBuilder()
    .setTitle('𓍢ִ໋ ✧˚ RADIANCE COMMS — SUPPORT CENTER')
    .setDescription(
`╭・welcome to support✦\nNeed assistance, want to partner with us, or have a giveaway/event inquiry? Select the appropriate ticket option on the panel below to open a private channel with our team! 🌈✨🌸\n\n┊・ticket categories💧\n- 💬 **General Support:** Server help, general questions, or reporting issues.\n- 🛡️ **Admin Support:** Confidential matters, staff reports, or higher management inquiries.\n- 🤝 **Partnerships:** Server alliances, affiliate inquiries, and PR collaborations\n- check requirements in [allie-req](https://discord.com/channels/1560366921105277071/1560651380044206200) first!\n- 💎 **Events & Giveaways:** Claim event/giveaway prizes, host your own events or giveaways, sponsor prizes, or ask questions!\n\n╰・important notices🌿\n- 🌸 **Not for Orders:** To order a bot or server build, please head to [Order Here](https://discord.com/channels/1560366921105277071/1560512621579472956).\n- ☀️ **Not for Verification:** To get verified, please head to [Verify](https://discord.com/channels/1560366921105277071/1560407817687666738) and ping \`@Verifier\`.\n- 🌾 **Response Time:** Please state your reason clearly upon opening. Our staff team will respond as soon as possible! ☁️✨`
    )
    .setColor('#8A2BE2')
    .setFooter({ text: 'Radiance Comms • Support Center' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:support').setLabel('Support').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('open_ticket:admin').setLabel('Admin Support').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('open_ticket:partnership').setLabel('Partnership').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('open_ticket:event').setLabel('Event / GWY').setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function buildPanelButtons_applications() {
  const embed = new EmbedBuilder()
    .setTitle('𓍢ִ໋ ✧˚ STAFF APPLICATIONS & INFORMATION')
    .setDescription(
`╭・welcome to radiance comms ✦\nThank you for your interest in joining the Radiance Comms team! We are looking for kind, dedicated, and active individuals who are passionate about helping our community grow and flourish. 🌈✨🌸\n\n┊・available positions 💧\nWe are currently accepting applications for:\n- 🌻 Moderator (Mod)\n- 🌈 Partnership Manager (PM)\n- 🌼 Event Host\n- 🦋 Social Media Manager (SMM)\n\n┊・requirements 🌿\nBefore applying, please make sure you meet the following requirements:\n- 🌸 Be respectful, mature, and professional\n- ☀️ Maintain a positive attitude toward members and staff\n- 🌱 Be reasonably active within the community\n- 🦋 Be able to work well as part of a team\n- 🌷 Follow all server rules and staff guidelines\n- 🌈 Be willing to learn, grow, and accept feedback\n- ☁️ Applications with low-effort responses may be denied\n\n┊・application process 🌼\n🌱 Step 1 — Choose Your Role: Select the position that best matches your skills and interests.\n🌸 Step 2 — Open an Application: Click the panel below to begin your application.\n🦋 Step 3 — Complete the Questions: Answer all questions honestly and in detail.\n🌻 Step 4 — Await Review: Our management team will review your application and contact you regarding their decision.\n\n╰・ready to bloom with us? 🌸\nClick the application panel below to begin your staff application. We can't wait to learn more about you and see how you can help Radiance Comms grow! ☁️✨🌈🌷🌻`
    )
    .setColor('#87CEEB')
    .setFooter({ text: 'Radiance Comms • Staff Applications' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:application').setLabel('Open Application').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function buildTicketEmbed(type, data = {}) {
  // data may contain: title, description, server_count, features, position, about
  const e = new EmbedBuilder();
  e.setColor('#F6E4FF');

  switch (type) {
    case 'application': {
      e.setTitle('🌸 𓍢ִ໋ ✧˚ STAFF APPLICATIONS');
      e.setDescription('╭・welcome to your application✦\n\nThank you for your interest in joining the Radiance Comms Team! Detailed applications have a much better chance of being considered than short, low-effort responses. 🌷');
      e.addFields(
        { name: '🎫 Ticket Type', value: 'Staff Application', inline: true },
        { name: '🌻 Position Applied For', value: data.position || 'Not provided', inline: true },
        { name: '🌸 About The Applicant', value: data.about || 'Please provide information about yourself in this channel.' }
      );
      e.setFooter({ text: 'Radiance Comms • Staff Applications' });
      break;
    }

    case 'commission': {
      e.setTitle('💐 𓍢ִ໋ ✧˚ COMMISSIONS & ORDERS');
      e.setDescription('╭・welcome to your commission✦\n\nThank you for choosing Radiance Comms! We\'re excited to work with you and bring your vision to life. Please provide as much detail as possible.');
      e.addFields(
        { name: '🎫 Ticket Type', value: 'Commission / Order', inline: true },
        { name: '🌻 Service/Package', value: data.title || 'Not provided', inline: true },
        { name: '📝 Details', value: data.description || 'Please provide your server link, style preferences, custom needs, and references here.' }
      );
      e.setFooter({ text: 'Radiance Comms • Commissions' });
      break;
    }

    case 'support': {
      e.setTitle('🌼 𓍢ִ໋ ✧˚ GENERAL SUPPORT');
      e.setDescription('╭・welcome to general support✦\n\nPlease explain your issue or question in as much detail as possible so we can assist you efficiently.');
      e.addFields(
        { name: '🎫 Ticket Type', value: 'General Support', inline: true },
        { name: '🌻 What Happened', value: 'Please describe the issue here.' },
        { name: '🦋 Evidence', value: 'Attach screenshots or links if applicable.' }
      );
      e.setFooter({ text: 'Radiance Comms • Support' });
      break;
    }

    case 'admin': {
      e.setTitle('☀️ 𓍢ִ໋ ✧˚ ADMIN SUPPORT');
      e.setDescription('╭・welcome to admin support✦\n\nThis ticket is intended for confidential matters, staff reports, or concerns requiring higher management.');
      e.addFields(
        { name: '🎫 Ticket Type', value: 'Admin Support', inline: true },
        { name: '🌻 Details', value: data.description || 'Provide a detailed explanation of your concern.' },
        { name: '🌸 User Info', value: data.userInfo || 'Mention relevant usernames or IDs.' },
        { name: '🦋 Evidence', value: 'Attach screenshots or proof if available.' }
      );
      e.setFooter({ text: 'Radiance Comms • Admin Support' });
      break;
    }

    case 'partnership': {
      e.setTitle('🌈 𓍢ִ໋ ✧˚ PARTNERSHIP REQUESTS');
      e.setDescription('╭・welcome to partnership requests✦\n\nThank you for your interest in partnering with Radiance Comms!');
      e.addFields(
        { name: '🎫 Ticket Type', value: 'Partnership Request', inline: true },
        { name: '🌻 Server Name', value: data.serverName || 'Please provide your server name.' },
        { name: '🌈 Invite Link', value: data.invite || 'Provide a permanent invite link.' },
        { name: '🌸 Member Count', value: data.memberCount || 'Provide your member count.' },
        { name: '🦋 Description', value: data.description || 'Briefly describe your server.' }
      );
      e.setFooter({ text: 'Radiance Comms • Partnerships' });
      break;
    }

    case 'event': {
      e.setTitle('🌼 𓍢ִ໋ ✧˚ EVENTS & GIVEAWAYS');
      e.setDescription('╭・welcome to events & giveaways✦\n\nWhether you\'re claiming a prize, hosting an event, or sponsoring, we\'re excited to collaborate!');
      e.addFields(
        { name: '🎫 Ticket Type', value: 'Events & Giveaways', inline: true },
        { name: '🌻 Ticket Reason', value: data.reason || 'Claiming a prize / Hosting / Sponsoring / Question' },
        { name: '🌸 Event/Giveaway Name', value: data.eventName || 'If applicable, provide the event name.' },
        { name: '🦋 Details & Proof', value: data.details || 'Provide proof or details here.' }
      );
      e.setFooter({ text: 'Radiance Comms • Events' });
      break;
    }

    default: {
      e.setTitle(`${type} ticket`);
      e.setDescription(`Hello, please describe your request here.`);
      e.setFooter({ text: 'Radiance Comms' });
      break;
    }
  }

  return e;
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const commissionPanel = await client.channels.fetch(PANEL_CHANNELS.commission).catch(() => null);
    if (commissionPanel) await commissionPanel.send(buildPanelButtons_forCommission());

    const genericPanel = await client.channels.fetch(PANEL_CHANNELS.generic).catch(() => null);
    if (genericPanel) await genericPanel.send(buildPanelButtons_generic());

    const appPanel = await client.channels.fetch(PANEL_CHANNELS.application).catch(() => null);
    if (appPanel) await appPanel.send(buildPanelButtons_applications());
  } catch (err) {
    console.error('Error posting panel messages:', err);
  }
});

async function createPrivateTicketChannel(guild, type, userId, initialEmbed, components = []) {
  const categoryId = CATEGORY_MAP[type];
  if (!categoryId) throw new Error(`No category configured for ticket type ${type}`);

  const sanitized = `${type}-${userId.slice(-4)}`.toLowerCase();
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
  ];

  // Always give general staff access if configured
  if (STAFF_ROLE_ID) {
    permissionOverwrites.push({ id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
  }

  // Add a manager role specific to this ticket type (e.g., admin role for admin tickets)
  const managerRoleId = MANAGER_ROLE_BY_TYPE[type];
  if (managerRoleId) {
    permissionOverwrites.push({ id: managerRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
  }

  const channel = await guild.channels.create({
    name: sanitized,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites
  });

  await channel.send({ content: `<@${userId}>`, embeds: initialEmbed ? [initialEmbed] : [], components });
  return channel;
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      const [action, ticketType] = interaction.customId.split(':');

      if (action === 'open_ticket') {
        // Fetch member and role flags
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const isClient = CLIENTS_ROLE_ID && member && member.roles.cache.has(CLIENTS_ROLE_ID);
        const isUnverified = UNVERIFIED_ROLE_ID && member && member.roles.cache.has(UNVERIFIED_ROLE_ID);
        const isStaff = STAFF_ROLE_ID && member && member.roles.cache.has(STAFF_ROLE_ID);
        const isAdmin = member && member.permissions && member.permissions.has(PermissionsBitField.Flags.Administrator);

        // Unverified members may only open support or admin tickets
        if (isUnverified && !['support', 'admin'].includes(ticketType)) {
          return interaction.reply({ content: 'Unverified members can only open Support or Admin Support tickets.', ephemeral: true });
        }

        // Admin tickets: allow creation by Clients, Unverified (if you want), Staff, or server Administrators
        if (ticketType === 'admin') {
          if (!(isClient || isUnverified || isStaff || isAdmin)) {
            return interaction.reply({ content: 'Only Clients, Unverified (support), staff, or server administrators can open Admin Support tickets.', ephemeral: true });
          }
        }

        if (ticketType === 'commission') {
          const modal = new ModalBuilder().setCustomId(`commission_modal:${interaction.user.id}`).setTitle('Submit Commission');

          const titleInput = new TextInputBuilder().setCustomId('title').setLabel('Short title').setStyle(TextInputStyle.Short).setRequired(true);
          const descInput = new TextInputBuilder().setCustomId('description').setLabel('Describe the project (features, scope)').setStyle(TextInputStyle.Paragraph).setRequired(true);
          const serversInput = new TextInputBuilder().setCustomId('server_count').setLabel('Server count (if server build)').setStyle(TextInputStyle.Short).setRequired(false);
          const featuresInput = new TextInputBuilder().setCustomId('features').setLabel('Features (comma separated keys)').setStyle(TextInputStyle.Short).setRequired(false);

          const row1 = new ActionRowBuilder().addComponents(titleInput);
          const row2 = new ActionRowBuilder().addComponents(descInput);
          const row3 = new ActionRowBuilder().addComponents(serversInput);
          const row4 = new ActionRowBuilder().addComponents(featuresInput);
          modal.addComponents(row1, row2, row3, row4);

          await interaction.showModal(modal);
          return;
        } else if (ticketType === 'application') {
          const modal = new ModalBuilder().setCustomId(`application_modal:${interaction.user.id}`).setTitle('Submit Application');
          const roleInput = new TextInputBuilder().setCustomId('role').setLabel('Which role/position are you applying for?').setStyle(TextInputStyle.Short).setRequired(true);
          const answersInput = new TextInputBuilder().setCustomId('answers').setLabel('Tell us why you are a good fit (short)').setStyle(TextInputStyle.Paragraph).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(roleInput), new ActionRowBuilder().addComponents(answersInput));
          await interaction.showModal(modal);
          return;
        } else {
          await interaction.deferReply({ ephemeral: true });
          const guild = interaction.guild;

          const embed = buildTicketEmbed(ticketType, {});

          const closeBtn = new ButtonBuilder().setCustomId(`ticket_close:${interaction.user.id}`).setLabel('Close Ticket').setStyle(ButtonStyle.Secondary);
          const row = new ActionRowBuilder().addComponents(closeBtn);

          const ch = await createPrivateTicketChannel(guild, ticketType, interaction.user.id, embed, [row]);
          const ticketId = db.createTicketRecord({ ticket_channel_id: ch.id, type: ticketType, user_id: interaction.user.id, commission_id: null, created_at: new Date().toISOString() });

          await interaction.editReply({ content: `Ticket created: <#${ch.id}>`, ephemeral: true });
          return;
        }
      }

      if (interaction.customId.startsWith('ticket_close:')) {
        await interaction.deferReply({ ephemeral: true });
        const [, userIdFromCustom] = interaction.customId.split(':');
        const channel = interaction.channel;
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaffClose = STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID);
        const isAdminClose = member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isStaffClose && !isAdminClose) {
          await interaction.editReply({ content: 'You do not have permission to close tickets.', ephemeral: true });
          return;
        }

        await channel.permissionOverwrites.edit(userIdFromCustom, { ViewChannel: false, SendMessages: false }).catch(() => null);
        await channel.send(`Ticket closed by <@${interaction.user.id}>.`);
        await interaction.editReply({ content: 'Ticket closed.', ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('commission_accept:') || interaction.customId.startsWith('commission_reject:') || interaction.customId.startsWith('commission_close:')) {
        await interaction.deferReply({ ephemeral: true });
        const [actionType, commissionIdStr] = interaction.customId.split(':');
        const commissionId = parseInt(commissionIdStr, 10);
        const commission = db.getCommission(commissionId);
        if (!commission) {
          await interaction.editReply({ content: 'Commission not found.', ephemeral: true });
          return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaff = STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID);
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isStaff && !isAdmin) {
          await interaction.editReply({ content: 'You do not have permission to perform this action.', ephemeral: true });
          return;
        }

        if (actionType === 'commission_accept') {
          db.updateCommissionStatus(commissionId, 'accepted');
          if (commission.ticket_channel_id) {
            const ch = await client.channels.fetch(commission.ticket_channel_id).catch(() => null);
            if (ch) await ch.send(`Commission #${commissionId} accepted by <@${interaction.user.id}>.`);
          }
          const user = await client.users.fetch(commission.user_id).catch(() => null);
          if (user) await user.send(`Your commission #${commissionId} has been accepted.`).catch(() => null);
          await interaction.editReply({ content: `Commission #${commissionId} accepted.`, ephemeral: true });
        } else if (actionType === 'commission_reject') {
          db.updateCommissionStatus(commissionId, 'rejected');
          if (commission.ticket_channel_id) {
            const ch = await client.channels.fetch(commission.ticket_channel_id).catch(() => null);
            if (ch) await ch.send(`Commission #${commissionId} rejected by <@${interaction.user.id}>.`);
          }
          const user = await client.users.fetch(commission.user_id).catch(() => null);
          if (user) await user.send(`Your commission #${commissionId} has been rejected.`).catch(() => null);
          await interaction.editReply({ content: `Commission #${commissionId} rejected.`, ephemeral: true });
        } else if (actionType === 'commission_close') {
          db.updateCommissionStatus(commissionId, 'completed');
          if (commission.ticket_channel_id) {
            const ch = await client.channels.fetch(commission.ticket_channel_id).catch(() => null);
            if (ch) {
              await ch.permissionOverwrites.edit(commission.user_id, { ViewChannel: false, SendMessages: false }).catch(() => null);
              await ch.send(`Commission ticket closed by <@${interaction.user.id}>.`);
            }
          }
          const user = await client.users.fetch(commission.user_id).catch(() => null);
          if (user) await user.send(`Your commission #${commissionId} ticket has been closed.`).catch(() => null);
          await interaction.editReply({ content: `Commission #${commissionId} closed.`, ephemeral: true });
        }
        return;
      }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId.startsWith('commission_modal:')) {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const server_count_raw = interaction.fields.getTextInputValue('server_count') || '0';
        const server_count = parseInt(server_count_raw, 10) || 0;
        const features_raw = interaction.fields.getTextInputValue('features') || '';
        const features = features_raw.split(',').map(f => f.trim()).filter(Boolean);

        // build an order for estimator: use tier/commands as needed; here we estimate based on features and tier defaults
        const order = {
          type: 'a_la_carte',
          aestheticItems: [],
          addons: {},
          commands: {},
          customFeatures: []
        };

        for (const f of features) order.customFeatures.push({ name: f, price: 0 });

        const estimate = estimateOrder(order, { taxRate: 0.0 });

        const commissionRecord = {
          user_id: userId,
          guild_id: interaction.guildId,
          title,
          description,
          type: 'commission',
          server_count,
          features: JSON.stringify(features),
          estimated_price: estimate.total.withoutTax.min,
          budget: null,
          deadline: null,
          status: 'pending',
          ticket_channel_id: null,
          created_at: new Date().toISOString()
        };

        const commissionId = db.createCommission(commissionRecord);

        const embed = new EmbedBuilder()
          .setTitle(`Commission #${commissionId} — ${title}`)
          .setDescription(description.slice(0, 4096))
          .addFields(
            { name: 'Submitted by', value: `<@${userId}>`, inline: true },
            { name: 'Estimate (USD)', value: `$${commissionRecord.estimated_price}`, inline: true },
            { name: 'Features', value: features.length ? features.join(', ') : 'None', inline: false }
          ).setTimestamp();

        const acceptBtn = new ButtonBuilder().setCustomId(`commission_accept:${commissionId}`).setLabel('Accept').setStyle(ButtonStyle.Success);
        const rejectBtn = new ButtonBuilder().setCustomId(`commission_reject:${commissionId}`).setLabel('Reject').setStyle(ButtonStyle.Danger);
        const closeBtn = new ButtonBuilder().setCustomId(`commission_close:${commissionId}`).setLabel('Close').setStyle(ButtonStyle.Secondary);

        const rows = [new ActionRowBuilder().addComponents(acceptBtn, rejectBtn, closeBtn)];

        const ch = await createPrivateTicketChannel(interaction.guild, 'commission', userId, embed, rows);
        db.setCommissionChannel(commissionId, ch.id);
        db.createTicketRecord({ ticket_channel_id: ch.id, type: 'commission', user_id: userId, commission_id: commissionId, created_at: new Date().toISOString() });

        try {
          const logChannelId = process.env.COMMISSIONS_LOG_CHANNEL_ID;
          if (logChannelId) {
            const logCh = await client.channels.fetch(logChannelId).catch(() => null);
            if (logCh) {
              const logEmbed = new EmbedBuilder()
                .setTitle(`New Commission #${commissionId} — ${title}`)
                .setDescription(description.slice(0, 2048))
                .addFields(
                  { name: 'Submitted by', value: `<@${userId}>`, inline: true },
                  { name: 'Estimate', value: `$${commissionRecord.estimated_price}`, inline: true },
                  { name: 'Ticket', value: `<#${ch.id}>`, inline: false }
                ).setTimestamp();
              await logCh.send({ embeds: [logEmbed] }).catch(() => null);
            }
          }
        } catch (err) {
          console.error('Logging commission failed', err);
        }

        await interaction.editReply({ content: `Commission submitted as #${commissionId}. Ticket created: <#${ch.id}>`, ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('application_modal:')) {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        const role = interaction.fields.getTextInputValue('role');
        const answers = interaction.fields.getTextInputValue('answers');

        const embed = new EmbedBuilder()
          .setTitle(`Application — ${role}`)
          .setDescription(answers.slice(0, 4096))
          .addFields({ name: 'Applicant', value: `<@${userId}>`, inline: true })
          .setTimestamp();

        const closeBtn = new ButtonBuilder().setCustomId(`ticket_close:${userId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(closeBtn);

        const ch = await createPrivateTicketChannel(interaction.guild, 'application', userId, embed, [row]);
        db.createTicketRecord({ ticket_channel_id: ch.id, type: 'application', user_id: userId, commission_id: null, created_at: new Date().toISOString() });

        await interaction.editReply({ content: `Application ticket created: <#${ch.id}>`, ephemeral: true });
        return;
      }
    }
  } catch (err) {
    console.error('Interaction error', err);
    try {
      if (interaction && (interaction.replied || interaction.deferred)) {
        await interaction.editReply({ content: 'There was an error handling that interaction.' }).catch(() => null);
      } else if (interaction) {
        await interaction.reply({ content: 'There was an error.', ephemeral: true }).catch(() => null);
      }
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
