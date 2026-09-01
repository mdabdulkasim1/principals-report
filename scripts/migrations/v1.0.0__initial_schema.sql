-- Migration: v1.0.0__initial_schema
-- Created: 2026-08-20

CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  place VARCHAR(255) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  schoolId VARCHAR(64) NULL,
  passHash TEXT NOT NULL,
  mustChangePassword TINYINT(1) DEFAULT 1,
  active TINYINT(1) DEFAULT 1,
  createdAt VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  schoolId VARCHAR(64) NOT NULL,
  month VARCHAR(50) NOT NULL,
  academicYear VARCHAR(50) DEFAULT '',
  status VARCHAR(50) NOT NULL,
  data LONGTEXT,
  kpis LONGTEXT,
  chairmanRemarks TEXT,
  createdBy VARCHAR(64) NULL,
  createdAt VARCHAR(64) NULL,
  updatedAt VARCHAR(64) NULL,
  submittedAt VARCHAR(64) NULL,
  reviewedAt VARCHAR(64) NULL,
  UNIQUE KEY school_month_idx (schoolId, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
