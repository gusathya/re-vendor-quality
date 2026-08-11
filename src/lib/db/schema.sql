-- src/lib/db/schema.sql

CREATE TABLE IF NOT EXISTS vendor_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  process_name TEXT NOT NULL,
  category_id TEXT REFERENCES vendor_categories(id),
  vendor_code TEXT UNIQUE,
  folder_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'vendor', 'customer')),
  vendor_id TEXT REFERENCES vendors(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sop_documents (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  file_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'superseded')) DEFAULT 'draft',
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT
);

CREATE TABLE IF NOT EXISTS sop_parameters (
  id TEXT PRIMARY KEY,
  sop_document_id TEXT NOT NULL REFERENCES sop_documents(id),
  station_group_key TEXT NOT NULL,
  sr_no TEXT NOT NULL,
  station_no TEXT,
  process TEXT NOT NULL,
  product_chemical TEXT,
  characteristic TEXT,
  min_value REAL,
  max_value REAL,
  unit TEXT,
  status TEXT NOT NULL CHECK (status IN ('parsed', 'needs_review', 'non_numeric', 'no_limit')),
  raw_control_limit TEXT,
  raw_spec_limit TEXT
);

CREATE TABLE IF NOT EXISTS station_aliases (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  station_group_key TEXT NOT NULL,
  load_report_station_name TEXT NOT NULL,
  UNIQUE (vendor_id, load_report_station_name)
);

CREATE TABLE IF NOT EXISTS load_reports (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  load_number TEXT NOT NULL,
  file_path TEXT NOT NULL,
  part_number TEXT,
  total_weight_kg REAL,
  load_in_time TEXT,
  load_out_time TEXT,
  total_time_seconds INTEGER,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  push_status TEXT NOT NULL DEFAULT 'draft' CHECK (push_status IN ('draft', 'pending', 'approved', 'rejected')),
  pushed_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(id),
  review_note TEXT,
  UNIQUE (vendor_id, load_number)
);

CREATE TABLE IF NOT EXISTS load_readings (
  id TEXT PRIMARY KEY,
  load_report_id TEXT NOT NULL REFERENCES load_reports(id),
  sop_parameter_id TEXT REFERENCES sop_parameters(id),
  station_no INTEGER NOT NULL,
  station_name TEXT NOT NULL,
  parameter_name TEXT NOT NULL,
  value REAL,
  dip_time_seconds INTEGER,
  recorded_at TEXT,
  score TEXT NOT NULL CHECK (score IN ('pass', 'fail', 'unscored'))
);

CREATE TABLE IF NOT EXISTS manual_checks (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  sop_parameter_id TEXT NOT NULL REFERENCES sop_parameters(id),
  value REAL NOT NULL,
  checked_at TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES users(id),
  score TEXT NOT NULL CHECK (score IN ('pass', 'fail'))
);

CREATE TABLE IF NOT EXISTS dashboard_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  filters_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
