-- users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  draftly_refresh_token TEXT,
  token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- style_profiles
CREATE TABLE IF NOT EXISTS style_profiles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  features JSONB NOT NULL,
  source_window INT DEFAULT 100,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- preferences
CREATE TYPE tone_enum AS ENUM ('formal', 'concise', 'friendly');

CREATE TABLE IF NOT EXISTS preferences (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  signature TEXT,
  default_tone tone_enum DEFAULT 'concise',
  style_profile_id INT REFERENCES style_profiles(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- drafts
CREATE TYPE draft_status_enum AS ENUM ('suggested','approved','edited','rejected','sent','failed');

CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id VARCHAR(255) NOT NULL,
  message_id VARCHAR(255),
  tone tone_enum,
  prompt TEXT,
  context_snapshot JSONB,
  body TEXT,
  status draft_status_enum DEFAULT 'suggested',
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- send_logs
CREATE TYPE send_status_enum AS ENUM ('success','retry','failed');

CREATE TABLE IF NOT EXISTS send_logs (
  id SERIAL PRIMARY KEY,
  draft_id INT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  attempt INT NOT NULL,
  status send_status_enum NOT NULL,
  error_code VARCHAR(100),
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- audit_logs
CREATE TYPE audit_action_enum AS ENUM (
  'login','logout','token_refresh',
  'draft_create','draft_edit','draft_approve','draft_reject',
  'send_attempt','send_success','send_fail'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action audit_action_enum NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);