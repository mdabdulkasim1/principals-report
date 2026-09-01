"use strict";
/**
 * MySQL Database Module.
 * All CRUD operations are executed directly against MySQL database tables (`schools`, `users`, `reports`).
 */
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const fs = require("fs");
const path = require("path");

let pool = null;

function loadEnv() {
  try { require("dotenv").config(); } catch (_) {}
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    }
  }
}

function getDbConfig() {
  loadEnv();
  const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQLURL || process.env.MYSQL_PRIVATE_URL || process.env.MYSQL_PUBLIC_URL || "";
  return {
    url: mysqlUrl,
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || process.env.DB_HOST || "localhost",
    port: Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.DB_USER || "root",
    password: process.env.MYSQLPASSWORD !== undefined ? process.env.MYSQLPASSWORD : (process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "")),
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || process.env.DB_NAME || "akbgroups_principal_report",
  };
}

function getPool() {
  if (!pool) {
    const config = getDbConfig();
    if (config.url) {
      pool = mysql.createPool(config.url);
    } else {
      pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    }
  }
  return pool;
}

async function init() {
  const { runMigrations } = require("../scripts/migrate");
  await runMigrations();
  getPool();
  
  const { seedIfEmpty } = require("./seed");
  await seedIfEmpty();
}

function id() {
  return crypto.randomUUID();
}

/* ------------------------------------------------------------------ */
/* Schools CRUD                                                      */
/* ------------------------------------------------------------------ */
async function getSchools() {
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM schools ORDER BY name ASC");
  return rows.map((s) => ({ id: s.id, name: s.name, place: s.place || "" }));
}

async function getSchoolById(schoolId) {
  if (!schoolId) return null;
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM schools WHERE id = ?", [schoolId]);
  if (!rows.length) return null;
  const s = rows[0];
  return { id: s.id, name: s.name, place: s.place || "" };
}

async function createSchool(school) {
  const p = getPool();
  await p.query(
    "INSERT INTO schools (id, name, place) VALUES (?, ?, ?)",
    [school.id, school.name, school.place || ""]
  );
  return school;
}

async function updateSchool(schoolId, fields) {
  const p = getPool();
  const existing = await getSchoolById(schoolId);
  if (!existing) return null;
  const name = fields.name !== undefined ? fields.name : existing.name;
  const place = fields.place !== undefined ? fields.place : existing.place;
  await p.query(
    "UPDATE schools SET name = ?, place = ? WHERE id = ?",
    [name, place, schoolId]
  );
  return { id: schoolId, name, place };
}

/* ------------------------------------------------------------------ */
/* Users CRUD                                                        */
/* ------------------------------------------------------------------ */
function formatUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    schoolId: u.schoolId || null,
    passHash: u.passHash,
    mustChangePassword: Boolean(u.mustChangePassword),
    active: Boolean(u.active),
    createdAt: u.createdAt || null,
  };
}

async function getUsers() {
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM users ORDER BY createdAt ASC");
  return rows.map(formatUser);
}

async function getUserById(userId) {
  if (!userId) return null;
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM users WHERE id = ?", [userId]);
  return rows.length ? formatUser(rows[0]) : null;
}

async function getUserByUsername(username) {
  if (!username) return null;
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [String(username)]);
  return rows.length ? formatUser(rows[0]) : null;
}

async function createUser(user) {
  const p = getPool();
  await p.query(
    `INSERT INTO users (id, username, name, role, schoolId, passHash, mustChangePassword, active, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.username,
      user.name,
      user.role,
      user.schoolId || null,
      user.passHash,
      user.mustChangePassword ? 1 : 0,
      user.active !== false ? 1 : 0,
      user.createdAt || new Date().toISOString(),
    ]
  );
  return formatUser(user);
}

async function updateUser(userId, fields) {
  const p = getPool();
  const existing = await getUserById(userId);
  if (!existing) return null;

  const username = fields.username !== undefined ? fields.username : existing.username;
  const name = fields.name !== undefined ? fields.name : existing.name;
  const role = fields.role !== undefined ? fields.role : existing.role;
  const schoolId = fields.schoolId !== undefined ? fields.schoolId : existing.schoolId;
  const passHash = fields.passHash !== undefined ? fields.passHash : existing.passHash;
  const mustChangePassword = fields.mustChangePassword !== undefined ? fields.mustChangePassword : existing.mustChangePassword;
  const active = fields.active !== undefined ? fields.active : existing.active;

  await p.query(
    `UPDATE users SET username = ?, name = ?, role = ?, schoolId = ?, passHash = ?, mustChangePassword = ?, active = ? WHERE id = ?`,
    [username, name, role, schoolId || null, passHash, mustChangePassword ? 1 : 0, active ? 1 : 0, userId]
  );
  return getUserById(userId);
}

async function deleteUser(userId) {
  const p = getPool();
  const [result] = await p.query("DELETE FROM users WHERE id = ?", [userId]);
  return result.affectedRows > 0;
}

/* ------------------------------------------------------------------ */
/* Reports CRUD                                                      */
/* ------------------------------------------------------------------ */
function formatReport(r) {
  if (!r) return null;
  let data = {};
  let kpis = {};
  try { data = typeof r.data === "string" ? JSON.parse(r.data) : (r.data || {}); } catch (_) {}
  try { kpis = typeof r.kpis === "string" ? JSON.parse(r.kpis) : (r.kpis || {}); } catch (_) {}
  return {
    id: r.id,
    schoolId: r.schoolId,
    month: r.month,
    academicYear: r.academicYear || "",
    status: r.status,
    data,
    kpis,
    chairmanRemarks: r.chairmanRemarks || "",
    createdBy: r.createdBy || null,
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null,
    submittedAt: r.submittedAt || null,
    reviewedAt: r.reviewedAt || null,
  };
}

async function getReports() {
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM reports");
  return rows.map(formatReport);
}

async function getReportById(reportId) {
  if (!reportId) return null;
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM reports WHERE id = ?", [reportId]);
  return rows.length ? formatReport(rows[0]) : null;
}

async function getReportBySchoolAndMonth(schoolId, month) {
  const p = getPool();
  const [rows] = await p.query("SELECT * FROM reports WHERE schoolId = ? AND month = ?", [schoolId, month]);
  return rows.length ? formatReport(rows[0]) : null;
}

async function createReport(report) {
  const p = getPool();
  await p.query(
    `INSERT INTO reports (id, schoolId, month, academicYear, status, data, kpis, chairmanRemarks, createdBy, createdAt, updatedAt, submittedAt, reviewedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      report.id,
      report.schoolId,
      report.month,
      report.academicYear || "",
      report.status,
      JSON.stringify(report.data || {}),
      JSON.stringify(report.kpis || {}),
      report.chairmanRemarks || "",
      report.createdBy || null,
      report.createdAt || null,
      report.updatedAt || null,
      report.submittedAt || null,
      report.reviewedAt || null,
    ]
  );
  return formatReport(report);
}

async function updateReport(reportId, fields) {
  const p = getPool();
  const existing = await getReportById(reportId);
  if (!existing) return null;

  const academicYear = fields.academicYear !== undefined ? fields.academicYear : existing.academicYear;
  const status = fields.status !== undefined ? fields.status : existing.status;
  const dataObj = fields.data !== undefined ? fields.data : existing.data;
  const kpisObj = fields.kpis !== undefined ? fields.kpis : existing.kpis;
  const chairmanRemarks = fields.chairmanRemarks !== undefined ? fields.chairmanRemarks : existing.chairmanRemarks;
  const updatedAt = fields.updatedAt !== undefined ? fields.updatedAt : existing.updatedAt;
  const submittedAt = fields.submittedAt !== undefined ? fields.submittedAt : existing.submittedAt;
  const reviewedAt = fields.reviewedAt !== undefined ? fields.reviewedAt : existing.reviewedAt;

  await p.query(
    `UPDATE reports SET academicYear = ?, status = ?, data = ?, kpis = ?, chairmanRemarks = ?, updatedAt = ?, submittedAt = ?, reviewedAt = ? WHERE id = ?`,
    [
      academicYear,
      status,
      JSON.stringify(dataObj || {}),
      JSON.stringify(kpisObj || {}),
      chairmanRemarks,
      updatedAt,
      submittedAt,
      reviewedAt,
      reportId,
    ]
  );
  return getReportById(reportId);
}

async function deleteReport(reportId) {
  const p = getPool();
  const [result] = await p.query("DELETE FROM reports WHERE id = ?", [reportId]);
  return result.affectedRows > 0;
}

module.exports = {
  init,
  id,
  getSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  getUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  getReports,
  getReportById,
  getReportBySchoolAndMonth,
  createReport,
  updateReport,
  deleteReport,
};
