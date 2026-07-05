# Database Backups & Migrations

## Overview

This document describes the database backup and migration strategy for StudySync.

## Migrations (Flyway)

### What is Flyway?

Flyway is a database migration tool that automatically applies versioned SQL scripts. It tracks which migrations have been applied and only runs new ones.

### File Structure

```
db/
├── migrations/
│   ├── V1__Initial_schema.sql
│   ├── V2__Add_courses_table.sql
│   ├── V3__Add_enrollments_table.sql
│   └── U3__Undo_enrollments_table.sql  # Undo scripts (optional)
└── README.md
```

### Naming Convention

- **V** = Versioned migration (must run in order)
- **U** = Undo migration (optional, rolls back a version)
- **Number** = Version number (1, 2, 3...)
- **Underscores** = Word separators in description
- **SQL** = File extension

### Create a New Migration

1. Create file in `db/migrations/` with pattern: `VXXX__Description.sql`
2. Write idempotent SQL (safe to run multiple times)
3. Commit and push
4. Migration will run automatically on deployment

### Example Migration

```sql
-- db/migrations/V4__Add_assessments_table.sql

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assessments_course_id ON assessments(course_id);
CREATE INDEX idx_assessments_due_date ON assessments(due_date);
```

### Apply Migrations

```bash
# Run all pending migrations
npm run db:migrate

# Check migration status
flyway info

# Validate migrations without applying
flyway validate
```

### Rollback Migrations

Flyway migrations are designed to be applied only (not rolled back automatically). To rollback:

1. Create an undo migration (e.g., `U4__Undo_assessments_table.sql`)
2. Undo migrations drop objects created in the corresponding versioned migration

```sql
-- db/migrations/U4__Undo_assessments_table.sql
DROP TABLE IF EXISTS assessments CASCADE;
```

### Best Practices

1. **Keep migrations small** — One logical change per file
2. **Use IF NOT EXISTS** — For idempotent scripts
3. **Index foreign keys** — Add indexes on FK columns for performance
4. **Test migrations** — Always test in staging before production
5. **Version control** — Commit all migrations to git
6. **Never modify applied migrations** — Create new migrations to fix issues
7. **Document changes** — Add comments explaining schema changes

## Backups

### Backup Strategy

- **Frequency:** Daily at 2 AM UTC
- **Retention:** 30 days of daily backups
- **Type:** Full database dumps compressed with gzip
- **Location:** AWS S3 or local `backups/` directory
- **RTO:** < 1 hour (time to restore)
- **RPO:** < 1 day (acceptable data loss)

### Manual Backup

```bash
# Create backup
npm run db:backup

# Output: backups/studysync-2026-07-05T08-22-20.sql.gz
```

### Automated Backups (Cron)

Add to `scripts/backup-scheduler.mjs`:

```javascript
import cron from 'node-cron';
import { spawn } from 'child_process';

// Run backup daily at 2 AM UTC
cron.schedule('0 2 * * *', () => {
  spawn('npm', ['run', 'db:backup'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
});
```

Start the scheduler:

```bash
node scripts/backup-scheduler.mjs
```

### S3 Backup Upload

After backup is created, upload to S3:

```bash
aws s3 cp backups/studysync-*.sql.gz s3://your-bucket/backups/ --sse AES256
```

### Backup Verification

Regularly verify backups are working:

```bash
# List backup files
ls -lh backups/

# Check backup integrity
gzip -t backups/studysync-*.sql.gz

# Verify file size is reasonable (should be > 1 MB for real data)
du -h backups/studysync-*.sql.gz
```

## Restore Procedures

### Full Database Restore

```bash
# 1. Stop application
sudo systemctl stop studysync

# 2. Restore from backup
npm run db:restore -- backups/studysync-2026-07-05T08-22-20.sql.gz

# 3. Verify restore
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# 4. Start application
sudo systemctl start studysync
```

### Point-in-Time Recovery (PITR)

For recovering to a specific point in time:

1. Identify backup file closest to desired time
2. Note any WAL (Write-Ahead Logs) archives after that time
3. Restore backup and replay WAL logs

```bash
# Restore to a specific timestamp
pg_basebackup -h localhost -D /var/lib/postgresql/pitr_backup
```

### Partial Restore (Single Table)

```bash
# Extract single table from backup
gunzip -c backups/studysync-*.sql.gz | grep -A 1000 "CREATE TABLE courses" | psql $DATABASE_URL
```

### Test Restore Procedure

Monthly test restore in staging:

1. Backup production database
2. Restore to staging environment
3. Run smoke tests to verify data integrity
4. Document any issues

## Monitoring

### Check Database Size

```sql
SELECT 
  pg_size_pretty(pg_database_size('studysync')) as size,
  (SELECT count(*) FROM pg_stat_user_tables) as table_count;
```

### Check Slow Queries

```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Monitor Migrations

```bash
flyway info
```

Output shows:
- Version number
- Description
- Type (SQL or JDBC)
- Installed on (timestamp)
- Status (SUCCESS, FAILED, etc.)

## Disaster Recovery Plan

### RTO/RPO Targets

- **RTO (Recovery Time Objective):** < 1 hour
- **RPO (Recovery Point Objective):** < 1 day

### Recovery Steps

1. **Assess incident** — Determine what data was lost/corrupted
2. **Identify backup** — Find backup closest to incident time
3. **Prepare staging** — Restore to staging first to verify
4. **Notify stakeholders** — Inform users of recovery window
5. **Execute restore** — Restore to production
6. **Verify data** — Run integrity checks
7. **Resume service** — Bring application back online
8. **Post-mortem** — Document root cause and prevention

## Environment-Specific Configuration

### Development

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/studysync_dev
DB_POOL_SIZE=5
```

### Staging

```bash
DATABASE_URL=postgresql://user:pass@staging-db.example.com:5432/studysync_staging
DB_POOL_SIZE=10
```

### Production

```bash
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/studysync_prod
DB_POOL_SIZE=20
DB_BACKUP_S3_BUCKET=studysync-backups-prod
```

## Troubleshooting

### Migration Failed

```bash
# Check migration status
flyway info

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql.log

# Manual fix (if needed)
psql $DATABASE_URL
# Fix the issue manually, then:
UPDATE flyway_schema_history SET success = true WHERE version = 4;
```

### Backup Failed

```bash
# Verify pg_dump is installed
which pg_dump

# Check permissions
ls -l /usr/bin/pg_dump

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Restore Failed

```bash
# Verify backup file is readable
gzip -t backups/studysync-*.sql.gz

# Check disk space
df -h /

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql.log
```

## See Also

- [Flyway Documentation](https://flywaydb.org/documentation/)
- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
- [AWS RDS Backups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_BackupRestore.html)
