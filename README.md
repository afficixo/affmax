<div align="center">
  <img src="./public/logo.png" alt="Crack Bounty" width="220" />

  <h1>Crack Bounty</h1>

  <p><strong>Connecting quality traffic with meaningful opportunity.</strong></p>

  <p>
    A private affiliate network experience for publishers and advertisers,
    built around discovery, clarity, and sustainable partnerships.
  </p>

  <p>
    <a href="https://crackbounty.afficix.com">Website</a>
    &nbsp;·&nbsp;
    <a href="mailto:contact@crackbounty.afficix.com">Contact</a>
  </p>
</div>

---

## A network built around performance

Crack Bounty brings publishers and advertisers together in a focused affiliate-network experience. Its public-facing story centers on campaign discovery, useful performance insight, and the relationships that help high-quality traffic find the right opportunities.

The product is designed to make that experience feel straightforward: a considered brand presence, a clear path to joining, and an account foundation shaped around manager-led oversight.

## A focused foundation

This repository contains the Crack Bounty homepage and account-entry experience. The signed-in destination is intentionally kept minimal as the product takes shape.

## PostgreSQL backup replication

The application continues to use only `DATABASE_URL`. To maintain a separate live backup, create an empty PostgreSQL database in a separate Neon project and configure `DATABASE_URL`, `BACKUP_DATABASE_URL`, and optionally `DIRECT_DATABASE_URL` in a private local environment. Never commit database URLs or expose them with a `NEXT_PUBLIC_` prefix.

Enable logical replication in the primary Neon project, then run:

```bash
npm run db:replica:setup
```

The setup command prepares the backup schema, creates a publication for all primary tables, and creates a subscription that copies existing rows and streams future inserts, updates, and deletes. The application does not connect to `BACKUP_DATABASE_URL`; the setup command uses the primary `DATABASE_URL` (or `DIRECT_DATABASE_URL`) to configure replication. PostgreSQL stores those connection details in the backup subscription.

Logical replication does not copy DDL or keep sequence values synchronized. Apply schema migrations to both databases in a safe order, and keep the backup read-only; it is not configured for automatic failover. Enabling logical replication in Neon is permanent, restarts project computes, and can prevent the primary compute from scaling to zero while subscribed.

The Vercel build applies `scripts/drop-unused-tables.sql` to the primary before `prisma db push`; backup schema preparation applies it as well. DDL is not replicated, so existing primary/backup pairs must have this cleanup applied to both databases with the subscription publication refreshed.

<div align="center">
  <sub>Thoughtfully connecting publishers, advertisers, and performance.</sub>
</div>
