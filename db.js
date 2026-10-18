// db.js - SQLite helper using better-sqlite3
const Database = require('better-sqlite3');
const db = new Database('bot-data.db');

function init() {
  db.prepare(`CREATE TABLE IF NOT EXISTS commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    guild_id TEXT,
    title TEXT,
    description TEXT,
    type TEXT,
    server_count INTEGER,
    features TEXT,
    estimated_price INTEGER,
    budget INTEGER,
    deadline TEXT,
    status TEXT,
    ticket_channel_id TEXT,
    created_at TEXT
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_channel_id TEXT,
    type TEXT,
    user_id TEXT,
    commission_id INTEGER,
    created_at TEXT
  )`).run();
}

function createCommission(obj) {
  const stmt = db.prepare(`INSERT INTO commissions
    (user_id,guild_id,title,description,type,server_count,features,estimated_price,budget,deadline,status,ticket_channel_id,created_at)
    VALUES (@user_id,@guild_id,@title,@description,@type,@server_count,@features,@estimated_price,@budget,@deadline,@status,@ticket_channel_id,@created_at)`);
  const info = stmt.run(obj);
  return info.lastInsertRowid;
}

function getCommission(id) {
  return db.prepare(`SELECT * FROM commissions WHERE id = ?`).get(id);
}

function updateCommissionStatus(id, status) {
  return db.prepare(`UPDATE commissions SET status = ? WHERE id = ?`).run(status, id);
}

function setCommissionChannel(id, channelId) {
  return db.prepare(`UPDATE commissions SET ticket_channel_id = ? WHERE id = ?`).run(channelId, id);
}

function createTicketRecord(obj) {
  const stmt = db.prepare(`INSERT INTO tickets (ticket_channel_id, type, user_id, commission_id, created_at) VALUES (@ticket_channel_id, @type, @user_id, @commission_id, @created_at)`);
  const info = stmt.run(obj);
  return info.lastInsertRowid;
}

module.exports = { init, createCommission, getCommission, updateCommissionStatus, setCommissionChannel, createTicketRecord };
