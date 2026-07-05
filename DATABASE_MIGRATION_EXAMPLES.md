# Database Migrations & Backups Example

## Example: Creating a Migration

```sql
-- db/migrations/V1__Initial_schema.sql

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructor_id UUID NOT NULL REFERENCES users(id),
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX idx_courses_published ON courses(published);

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  enrolled_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_completed_at ON enrollments(completed_at);
```

## Example: Applying Migrations

```bash
# List available migrations
$ flyway info
Database: jdbc:postgresql://localhost:5432/studysync

SchemaVersion | Description          | Type | Installed On        | State
------+----------------------+------+---------------------+--------
1     | Initial schema       | SQL  | 2026-07-05 08:22:20 | Success
2     | << Pending >>        |      |                     | Pending

# Apply migrations
$ npm run db:migrate
Flyway Community Edition 10.0.0 by Redgate
Database: jdbc:postgresql://localhost:5432/studysync (PostgreSQL 14.5)
Schema history table "public.flyway_schema_history" does not exist yet and will be created by Flyway if the schema contains no other tables.
Successfully validated 2 migrations (execution time 00.145s)
Executing migration V1 ...
Executing migration V2 ...
Successfully applied 2 migrations in 0.235s
```

## Example: Creating a Backup

```bash
$ npm run db:backup
2026-07-05T08:22:20.000Z - info: db_backup_start: database=studysync, backupFile=/path/to/backups/studysync-2026-07-05T08-22-20.sql.gz
2026-07-05T08:22:35.000Z - info: db_backup_success: database=studysync, backupFile=/path/to/backups/studysync-2026-07-05T08-22-20.sql.gz

# Verify backup
$ ls -lh backups/
total 245M
-rw-r--r-- 1 user staff 245M Jul  5 08:22 studysync-2026-07-05T08-22-20.sql.gz

# Test backup integrity
$ gzip -t backups/studysync-2026-07-05T08-22-20.sql.gz
# (no output = success)
```

## Example: Restoring a Database

```bash
# WARNING: This will overwrite the current database!
$ npm run db:restore -- backups/studysync-2026-07-05T08-22-20.sql.gz

2026-07-05T08:25:00.000Z - warn: db_restore_start: database=studysync, backupFile=backups/studysync-2026-07-05T08-22-20.sql.gz, message=CAUTION: This will overwrite the current database!
2026-07-05T08:25:45.000Z - info: db_restore_success: database=studysync, backupFile=backups/studysync-2026-07-05T08-22-20.sql.gz

# Verify restore
$ psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
 count
-------
   150
(1 row)
```

## Example: Manual Recovery Procedure

### Scenario: User accidentally deleted important data

```bash
# Step 1: Identify the time of data loss
# User reports data was lost around 2 PM UTC

# Step 2: Find appropriate backup
$ ls -lh backups/ | grep "2026-07-05"
-rw-r--r-- 1 user staff 245M Jul  5 13:00 studysync-2026-07-05T12-00-00.sql.gz  # Before loss
-rw-r--r-- 1 user staff 246M Jul  5 14:00 studysync-2026-07-05T14-00-00.sql.gz  # After loss

# Use the 13:00 backup (before data loss)

# Step 3: Restore to staging for verification
$ STAGING_DATABASE_URL=postgresql://user:pass@staging-db/studysync_staging \
  npm run db:restore -- backups/studysync-2026-07-05T13-00-00.sql.gz

# Step 4: Verify data is present in staging
$ psql $STAGING_DATABASE_URL -c "SELECT * FROM users WHERE id = 'missing-user-id';"

# Step 5: Backup current production (just in case)
$ npm run db:backup

# Step 6: Restore to production
$ npm run db:restore -- backups/studysync-2026-07-05T13-00-00.sql.gz

# Step 7: Verify data is restored
$ psql $DATABASE_URL -c "SELECT * FROM users WHERE id = 'missing-user-id';"

# Step 8: Restart application
$ sudo systemctl restart studysync

# Step 9: Run smoke tests
$ npm run test:smoke
```

## Example: Setting Up Automated Backups

```bash
# Create backup scheduler
$ cat > scripts/backup-scheduler.mjs << 'EOF'
import cron from 'node-cron';
import { spawn } from 'child_process';
import { logger } from '../src/lib/logger.js';

// Run backup daily at 2 AM UTC
cron.schedule('0 2 * * *', () => {
  logger.info('Starting scheduled database backup');
  
  const backup = spawn('npm', ['run', 'db:backup'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  
  backup.on('exit', (code) => {
    if (code === 0) {
      logger.info('Scheduled database backup completed successfully');
    } else {
      logger.error('Scheduled database backup failed');
    }
  });
});

logger.info('Database backup scheduler started (daily at 2 AM UTC)');
EOF

# Run scheduler
$ node scripts/backup-scheduler.mjs &
```

## Key Points

1. **Migrations are sequential** — Each migration builds on the previous one
2. **Backups are full exports** — Include all data, schema, and indexes
3. **Always test restores** — Verify backup integrity monthly
4. **Document changes** — Keep git history of all migrations
5. **Monitor database** — Track growth and slow queries
6. **Plan recovery** — Have runbooks for common scenarios
