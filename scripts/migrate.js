"use strict";
/**
 * Database Migration Runner
 * Supports versioned migration files (e.g. v1.0.0__initial_schema.sql, v1.1.0__add_tables.sql, 001_initial_schema.sql).
 * Executes pending migrations in version order and records execution logs in `schema_migrations`.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

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

/** Extract version prefix from filename (e.g. v1.0.0__initial_schema.sql -> v1.0.0) */
function extractVersion(filename) {
  const base = filename.replace(/\.sql$/i, "");
  const match = base.match(/^([vV]?\d+(\.\d+)*(-\w+)?|\d+)/);
  if (match) return match[0];
  const parts = base.split(/__|_(?=[a-zA-Z])/);
  return parts[0] || base;
}

async function runMigrations() {
  const config = getDbConfig();
  if (config.url) {
    console.log(`[Migration] Connecting to MySQL server via MYSQL_URL / DATABASE_URL...`);
  } else {
    console.log(`[Migration] Connecting to MySQL server (${config.host}:${config.port}, DB: ${config.database})...`);
  }

  let pool;
  if (config.url) {
    pool = mysql.createPool({
      uri: config.url,
      multipleStatements: true,
      waitForConnections: true,
      connectionLimit: 5,
    });
  } else {
    // 1. Ensure database exists if connection allows
    try {
      const sysConn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        multipleStatements: true,
      });
      await sysConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
      await sysConn.end();
    } catch (err) {
      console.warn(`[Migration] [WARN] System database creation check skipped: ${err.message}`);
    }

    // 2. Connect to database
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: true,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  try {
    // 3. Ensure migrations log table exists (with version column)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(50) NULL,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'SUCCESS'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure version column exists if table was created previously without it
    try {
      await pool.query(`ALTER TABLE schema_migrations ADD COLUMN version VARCHAR(50) NULL AFTER id`);
    } catch (_) {
      // Column already exists
    }

    // 4. Fetch applied migrations
    const [appliedRows] = await pool.query("SELECT name FROM schema_migrations WHERE status = 'SUCCESS'");
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 5. Read & sort migration files naturally by version
    const migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("[Migration] No migrations directory found. Skipping.");
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => {
        const verA = extractVersion(a);
        const verB = extractVersion(b);
        return verA.localeCompare(verB, undefined, { numeric: true, sensitivity: "base" });
      });

    let executedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      const version = extractVersion(file);
      console.log(`[Migration] Running migration [${version}]: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        
        if (sql.trim()) {
          await conn.query(sql);
        }

        await conn.query(
          `INSERT INTO schema_migrations (version, name, status) VALUES (?, ?, 'SUCCESS')
           ON DUPLICATE KEY UPDATE version = VALUES(version), status = 'SUCCESS', executed_at = CURRENT_TIMESTAMP`,
          [version, file]
        );

        await conn.commit();
        executedCount++;
        console.log(`[Migration] Successfully applied [${version}]: ${file}`);
      } catch (err) {
        await conn.rollback();
        console.error(`[Migration] ERROR in [${version}] ${file}:`, err.message);
        try {
          await pool.query(
            `INSERT INTO schema_migrations (version, name, status) VALUES (?, ?, 'FAILED')
             ON DUPLICATE KEY UPDATE version = VALUES(version), status = 'FAILED', executed_at = CURRENT_TIMESTAMP`,
            [version, file]
          );
        } catch (_) {}
        throw err;
      } finally {
        conn.release();
      }
    }

    if (executedCount === 0) {
      console.log("[Migration] Database schema is up to date. No pending migrations.");
    } else {
      console.log(`[Migration] Finished applying ${executedCount} migration(s).`);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("[Migration] Migration task completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migration] Migration failed:", err);
      process.exit(1);
    });
}

module.exports = { runMigrations, extractVersion, getDbConfig };

