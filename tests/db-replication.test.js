const test = require('node:test')
const assert = require('node:assert/strict')
const { getConnectionUrls, normalizeConnectionUrl } = require('../scripts/setup-db-replication')

test('normalizes a Neon pooler URL to its direct endpoint', () => {
  assert.equal(
    normalizeConnectionUrl('postgresql://user:pass@ep-test-pooler.region.aws.neon.tech/app?sslmode=require', 'DATABASE_URL'),
    'postgresql://user:pass@ep-test.region.aws.neon.tech/app?sslmode=require',
  )
})

test('requires a separate backup database URL', () => {
  assert.throws(
    () => getConnectionUrls({ DATABASE_URL: 'postgresql://user:pass@primary.example/db' }),
    /Set BACKUP_DATABASE_URL/,
  )
})

test('rejects a backup URL that points to the primary database', () => {
  assert.throws(
    () => getConnectionUrls({
      DATABASE_URL: 'postgresql://user:pass@db.example/app',
      BACKUP_DATABASE_URL: 'postgresql://user:pass@db.example/backup',
    }),
    /separate database host/,
  )
})

test('uses the direct primary URL when provided', () => {
  const urls = getConnectionUrls({
    DATABASE_URL: 'postgresql://user:pass@ep-test-pooler.region.aws.neon.tech/app',
    DIRECT_DATABASE_URL: 'postgresql://user:pass@ep-test.region.aws.neon.tech/app',
    BACKUP_DATABASE_URL: 'postgresql://user:pass@ep-backup.region.aws.neon.tech/app',
  })

  assert.equal(new URL(urls.primaryUrl).hostname, 'ep-test.region.aws.neon.tech')
})
