// db.js - lightweight JSON file storage (no native SQL bindings required)
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'bot-data.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialState = {
      commissions: [],
      tickets: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialState, null, 2), 'utf8');
  }
}

function readState() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    const fallback = {
      commissions: [],
      tickets: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function writeState(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function init() {
  ensureDataFile();
}

function createCommission(obj) {
  const state = readState();
  const nextId = state.commissions.length ? state.commissions[state.commissions.length - 1].id + 1 : 1;
  const row = { id: nextId, ...obj };
  state.commissions.push(row);
  writeState(state);
  return nextId;
}

function getCommission(id) {
  const state = readState();
  return state.commissions.find((row) => Number(row.id) === Number(id)) || null;
}

function updateCommissionStatus(id, status) {
  const state = readState();
  const index = state.commissions.findIndex((row) => Number(row.id) === Number(id));
  if (index === -1) return false;
  state.commissions[index].status = status;
  writeState(state);
  return true;
}

function setCommissionChannel(id, channelId) {
  const state = readState();
  const index = state.commissions.findIndex((row) => Number(row.id) === Number(id));
  if (index === -1) return false;
  state.commissions[index].ticket_channel_id = channelId;
  writeState(state);
  return true;
}

function createTicketRecord(obj) {
  const state = readState();
  const nextId = state.tickets.length ? state.tickets[state.tickets.length - 1].id + 1 : 1;
  const row = { id: nextId, ...obj };
  state.tickets.push(row);
  writeState(state);
  return nextId;
}

function updateTicketClose(ticketChannelId, closed_by, reason, transcript_path) {
  const state = readState();
  const index = state.tickets.findIndex((t) => t.ticket_channel_id === String(ticketChannelId));
  if (index === -1) return false;
  state.tickets[index].closed_at = new Date().toISOString();
  state.tickets[index].closed_by = closed_by;
  state.tickets[index].close_reason = reason || null;
  state.tickets[index].transcript_path = transcript_path || null;
  writeState(state);
  return true;
}

module.exports = {
  init,
  createCommission,
  getCommission,
  updateCommissionStatus,
  setCommissionChannel,
  createTicketRecord,
  updateTicketClose
};
