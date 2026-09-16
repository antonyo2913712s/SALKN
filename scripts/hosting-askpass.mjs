#!/usr/bin/env node
import { readLocalConfig } from './local-config.mjs';

// This helper is called by OpenSSH; never run it to inspect a credential.
if (process.env.SALKN_ASKPASS !== '1' || !/password:/i.test(process.argv[2] || '')) process.exit(1);
try {
  const password = readLocalConfig().HOSTING_PASSWORD;
  if (!password) process.exit(1);
  process.stdout.write(password + '\n');
} catch { process.exit(1); }
