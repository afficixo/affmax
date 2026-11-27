const { spawnSync } = require('node:child_process')
const { loadEnvConfig } = require('@next/env')
const { Client } = require('pg')

const publicationName = 'affmax_backup_publication'
const subscriptionName = 'affmax_backup_subscription'
const prismaCli = require.resolve('prisma/build/index.js')
const schemaSqlFiles = [
  'prisma/migrations/20261123210000_remove_unneeded_postback_fields/migration.sql',
  'prisma/migrations/20261123211000_restore_postback_ip_field/migration.sql',
  'prisma/migrations/20261123211500_allow_multiple_marketplace_postbacks/migration.sql',
  'prisma/migrations/20261123214500_preserve_leads_when_postback_deleted/migration.sql',
  'scripts/ensure-marketplace-offer-mapping.sql',
  'prisma/migrations/20261127010000_add_marketplace_cmpid_token/migration.sql',
  'scripts/drop-unused-tables.sql',
]

function normalizeConnectionUrl(value, name) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL.`)
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${name} must use the PostgreSQL protocol.`)
  }

  if (url.hostname.includes('-pooler.')) {
    url.hostname = url.hostname.replace('-pooler.', '.')
  }

  return url.toString()
}

function getConnectionUrls(env = process.env) {
  const primaryUrl = env.DIRECT_DATABASE_URL || env.DATABASE_URL
  if (!primaryUrl) {
    throw new Error('Set DATABASE_URL or DIRECT_DATABASE_URL to the primary PostgreSQL database.')
  }
  if (!env.BACKUP_DATABASE_URL) {
    throw new Error('Set BACKUP_DATABASE_URL to the separate, empty backup PostgreSQL database.')
  }

  const primary = new URL(normalizeConnectionUrl(primaryUrl, 'Primary database URL'))
  const backup = new URL(normalizeConnectionUrl(env.BACKUP_DATABASE_URL, 'BACKUP_DATABASE_URL'))
  if (primary.hostname === backup.hostname) {
    throw new Error('The backup database must use a separate database host or Neon project.')
  }

  return {
    primaryUrl: primary.toString(),
    backupUrl: backup.toString(),
  }
}

function runPrisma(args, databaseUrl) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
    windowsHide: true,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Prisma command failed (${args.join(' ')}).`)
  }
}

async function hasUserTables(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ) AS has_tables
  `)
  return result.rows[0].has_tables
}

async function ensurePublication(client) {
  const existing = await client.query(
    'SELECT puballtables FROM pg_catalog.pg_publication WHERE pubname = $1',
    [publicationName],
  )

  if (existing.rowCount > 0) {
    if (!existing.rows[0].puballtables) {
      throw new Error(`Publication "${publicationName}" already exists but does not publish all tables.`)
    }
    return
  }

  await client.query(`CREATE PUBLICATION ${publicationName} FOR ALL TABLES`)
}

async function createSubscription(client, replicationUrl) {
  const existing = await client.query(
    'SELECT subenabled FROM pg_catalog.pg_subscription WHERE subname = $1',
    [subscriptionName],
  )
  if (existing.rowCount > 0) {
    throw new Error(`Subscription "${subscriptionName}" already exists; refusing to replace it.`)
  }

  const connectionString = replicationUrl.replace(/'/g, "''")
  await client.query(`
    CREATE SUBSCRIPTION ${subscriptionName}
    CONNECTION '${connectionString}'
    PUBLICATION ${publicationName}
    WITH (copy_data = true, create_slot = true, enabled = true)
  `)
}

async function setupReplication() {
  const { primaryUrl, backupUrl } = getConnectionUrls()
  const primary = new Client({ connectionString: primaryUrl, application_name: 'affmax-replication-setup' })
  const backup = new Client({ connectionString: backupUrl, application_name: 'affmax-replication-setup' })

  try {
    await primary.connect()
    await backup.connect()

    const walLevel = await primary.query('SHOW wal_level')
    if (walLevel.rows[0].wal_level !== 'logical') {
      throw new Error('Enable logical replication for the primary Neon project first; this restarts its computes.')
    }

    if (await hasUserTables(backup)) {
      throw new Error('The backup database must be empty before setup; existing user tables were found.')
    }

    console.log('Preparing the backup database schema...')
    runPrisma(['db', 'push', '--skip-generate'], backupUrl)
    for (const file of schemaSqlFiles) {
      runPrisma(['db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'], backupUrl)
    }

    await ensurePublication(primary)
    await createSubscription(backup, primaryUrl)
    console.log('Replication is configured. Initial data copy and continuous row replication are running.')
  } finally {
    await Promise.allSettled([primary.end(), backup.end()])
  }
}

if (require.main === module) {
  loadEnvConfig(process.cwd())
  setupReplication().catch((error) => {
    console.error(`Database replication setup failed: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { getConnectionUrls, normalizeConnectionUrl }
