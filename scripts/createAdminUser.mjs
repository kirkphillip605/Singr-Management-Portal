#!/usr/bin/env node
// create-user.mjs
// Usage:
//   Interactive: node create-user.mjs
//   With args:   node create-user.mjs --type admin --name "Jane Admin" --email jane@example.com --password "secret"
// Requires: npm i pg argon2 dotenv

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { Client } from 'pg';
import argon2 from 'argon2';
import readline from 'readline';

// ---- Config ----
const DATABASE_URL = process.env.DATABASE_URL;

// ---- Tiny argv parser ----
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), argv[i + 1]];
      if (!a.includes('=') && typeof v === 'string' && !v.startsWith('--')) {
        out[k] = v;
        i++;
      } else {
        out[k] = v ?? true;
      }
    }
  }
  return out;
}

// ---- Readline helpers ----
function createRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
}
function question(rl, q) {
  return new Promise((resolve) => rl.question(q, (ans) => resolve(ans)));
}

/**
 * Ask for hidden input (no echo). Shows the prompt text, masks entered chars.
 */
async function questionHidden(rl, promptText = 'Password: ') {
  const origWrite = rl._writeToOutput;
  rl._writeToOutput = function (stringToWrite) {
    if (rl.stdoutMuted) {
      if (stringToWrite.endsWith('\n')) origWrite.call(this, '\n');
      else origWrite.call(this, '*');
    } else origWrite.call(this, stringToWrite);
  };

  rl.output.write(promptText);
  rl.stdoutMuted = true;

  const answer = await new Promise((resolve) => {
    rl.question('', (val) => {
      rl.stdoutMuted = false;
      rl._writeToOutput = origWrite;
      rl.output.write('\n');
      resolve(val);
    });
  });

  return answer;
}

// ---- SQL Queries ----
const SQL = {
  checkPasswordHashColumn: `
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = 'password_hash';
  `,
  findUserByEmail: `
    SELECT id FROM public.%I WHERE email = $1;
  `,
  createUserBase: `
    INSERT INTO public.%I (name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id;
  `,
  createUserAdmin: `
    INSERT INTO public.users (name, email, password_hash, accounttype, admin_level)
    VALUES ($1, $2, $3, 'admin', 'super_admin')
    RETURNING id;
  `,
  createUserCustomer: `
    INSERT INTO public.users (name, email, password_hash, accounttype)
    VALUES ($1, $2, $3, 'customer')
    RETURNING id;
  `,
  updateUserCore: `
    UPDATE public.%I
       SET name = COALESCE($1, name),
           password_hash = $2,
           updated_at = now()
     WHERE id = $3;
  `,
};

// ---- Utility: safe identifier injection ----
function formatIdentifier(sql, identifier) {
  return sql.replace('%I', identifier);
}

// ---- Main ----
async function main() {
  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set.');
    console.log('Please set it in your .env file, e.g.:');
    console.log("DATABASE_URL='postgresql://user:pass@host:port/database'");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const rl = createRL();

  try {
    console.log('✨ Create / ensure a user account\n');

    const userType = (args.type ?? (await question(rl, 'User Type (admin, customer, singer): ')))
      .trim()
      .toLowerCase();

    if (!['admin', 'customer', 'singer'].includes(userType)) {
      throw new Error('Invalid user type. Must be one of: admin, customer, singer.');
    }

    const name = (args.name ?? (await question(rl, 'Full Name: '))).trim();
    const email = (args.email ?? (await question(rl, 'User Email: '))).trim().toLowerCase();

    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }

    let password = args.password;
    if (!password) {
      const pw1 = await questionHidden(rl, 'Create New Password: ');
      const pw2 = await questionHidden(rl, 'Verify Password: ');
      if (!pw1) throw new Error('Password cannot be empty.');
      if (pw1 !== pw2) throw new Error('Passwords do not match.');
      password = pw1;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: 2,
      memoryCost: 1048576,
      parallelism: 4,
    });

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      const table = userType === 'singer' ? 'singer_users' : 'users';

      const chk = await client.query(SQL.checkPasswordHashColumn, [table]);
      if (chk.rowCount === 0) {
        throw new Error(
          `The column public.${table}.password_hash doesn't exist.\n` +
            `Add it first: ALTER TABLE public.${table} ADD COLUMN password_hash text NOT NULL;`
        );
      }

      await client.query('BEGIN');

      const findQuery = formatIdentifier(SQL.findUserByEmail, table);
      const existing = await client.query(findQuery, [email]);
      let userId;

      if (existing.rowCount > 0) {
        const updateQuery = formatIdentifier(SQL.updateUserCore, table);
        userId = existing.rows[0].id;
        await client.query(updateQuery, [name || null, passwordHash, userId]);
        console.log(`Updated existing ${userType} user: ${email}`);
      } else {
        let insertQuery;
        if (userType === 'admin') insertQuery = SQL.createUserAdmin;
        else if (userType === 'customer') insertQuery = SQL.createUserCustomer;
        else insertQuery = formatIdentifier(SQL.createUserBase, table);

        const created = await client.query(insertQuery, [name || null, email, passwordHash]);
        userId = created.rows[0].id;
        console.log(`Created new ${userType} user ${email} (${userId}).`);
      }

      await client.query('COMMIT');

      console.log('\n✅ Account Creation Successful!');
      console.log(`- Email: ${email}`);
      console.log(`- Type: ${userType}`);
      if (userType === 'admin') {
        console.log(`- Account Type: admin`);
        console.log(`- Admin Level: super_admin`);
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
