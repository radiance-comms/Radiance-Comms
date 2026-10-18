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
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:commission').setLabel('Open Commission').setStyle(ButtonStyle.Primary)
  );
  return { content: 'Open a commission ticket (hire Radiance Comms for server/bot/custom work).', components: [row] };
}

function buildPanelButtons_generic() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:support').setLabel('Support').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('open_ticket:admin').setLabel('Admin Support').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('open_ticket:partnership').setLabel('Partnership').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('open_ticket:event').setLabel('Event / GWY').setStyle(ButtonStyle.Success)
  );
  return { content: 'Choose a ticket type and a staff member will assist you shortly.', components: [row] };
}

function buildPanelButtons_applications() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:application').setLabel('Open Application').setStyle(ButtonStyle.Primary)
  );
  return { content: 'Open an application ticket here.', components: [row] };
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
          const embed = new EmbedBuilder().setTitle(`${ticketType} ticket`).setDescription(`Hello <@${interaction.user.id}>, please describe your request here.`).addFields(
            { name: 'Created by', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Type', value: ticketType, inline: true }
          ).setTimestamp();

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
