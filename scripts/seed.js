"use strict";
/**
 * Database Seeder Script
 * Populates initial default accounts and schools if database is empty and records seeder execution logs.
 */
const mysql = require("mysql2/promise");
const db = require("../lib/db");
const seedModule = require("../lib/seed");

const fs = require("fs");
const path = require("path");

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

async function runSeeder() {
  const config = getDbConfig();
  if (config.url) {
    console.log(`[Seeder] Connecting to MySQL database via MYSQL_URL / DATABASE_URL...`);
  } else {
    console.log(`[Seeder] Connecting to MySQL database (${config.host}:${config.port}, DB: ${config.database})...`);
  }

  // Ensure DB connection and seeder log table exist
  let pool;
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
      connectionLimit: 5,
    });
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seeder_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Initialize db cache from MySQL
    await db.init();

    const result = await seedModule.seedIfEmpty();
    if (result.seeded) {
      const detailsStr = `Seeded Admin (${result.defaults.admin.username}) and ${result.defaults.schools.length} initial school(s).`;
      
      await pool.query(
        `INSERT INTO seeder_logs (name, details) VALUES (?, ?)`,
        ["initial_seeder", detailsStr]
      );

      console.log("\n  [Seeder] First run — seeded database with default accounts:");
      console.log("  Chairman (admin):  chairman / Chairman@123");
      console.log("  Principal (AKB):   principal.akb / Principal@123");
      console.log("  Principal (2nd):   principal.school2 / Principal@123");
      console.log("  >> Change these passwords after first login.\n");
    } else {
      console.log("[Seeder] Database already contains users. Skipping seeder.");
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runSeeder()
    .then(() => {
      console.log("[Seeder] Seeding task completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seeder] Seeding failed:", err);
      process.exit(1);
    });
}

module.exports = { runSeeder };
