/**
 * Migration script: FileStorageClient (JSON) → SupabaseStorageClient (PostgreSQL)
 *
 * This script reads data from data/memories.json and migrates it to Supabase.
 *
 * Prerequisites:
 * 1. Supabase project created
 * 2. Database schema applied (run supabase/schema.sql in SQL Editor)
 * 3. Environment variables set:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_KEY
 *
 * Usage:
 *   bun run scripts/migrate-to-supabase.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { SupabaseStorageClient, Person } from '../src/services/supabaseStorageClient';

const DATA_FILE = './data/memories.json';

interface StorageData {
  people: { [key: string]: Person };
  version: string;
  lastModified: string;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Nametag: File Storage → Supabase Migration    ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Check if data file exists
  if (!fs.existsSync(DATA_FILE)) {
    console.log('❌ No data file found at', DATA_FILE);
    console.log('   Nothing to migrate. Exiting.');
    process.exit(0);
  }

  // Verify Supabase credentials
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials!');
    console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env file');
    process.exit(1);
  }

  console.log('✓ Found data file:', DATA_FILE);
  console.log('✓ Supabase credentials configured\n');

  // Read JSON data
  console.log('Reading data from JSON file...');
  const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
  const storageData: StorageData = JSON.parse(fileData);

  const people = Object.values(storageData.people);
  console.log(`✓ Found ${people.length} people to migrate\n`);

  if (people.length === 0) {
    console.log('No data to migrate. Exiting.');
    process.exit(0);
  }

  // Display summary
  console.log('Migration Summary:');
  console.log('─────────────────────────────────────────────────');
  people.forEach((person, index) => {
    const convCount = person.conversationHistory?.length || 0;
    console.log(`  ${index + 1}. ${person.name} (Speaker ${person.speakerId})`);
    console.log(`     └─ ${convCount} conversation(s)`);
  });
  console.log('─────────────────────────────────────────────────\n');

  // Confirm migration
  console.log('⚠️  This will INSERT all people into Supabase.');
  console.log('   Existing people with the same name will be UPDATED.\n');

  // Initialize Supabase client
  console.log('Connecting to Supabase...');
  let supabaseClient: SupabaseStorageClient;
  try {
    supabaseClient = new SupabaseStorageClient();
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error);
    process.exit(1);
  }

  // Migrate each person
  console.log('Starting migration...\n');
  let successCount = 0;
  let errorCount = 0;

  for (const person of people) {
    try {
      console.log(`Migrating: ${person.name}...`);

      // Ensure conversationHistory exists (handle old format)
      if (!person.conversationHistory) {
        person.conversationHistory = [];
        if (person.lastConversation || person.lastTopics) {
          person.conversationHistory.push({
            date: person.lastMet || new Date(),
            transcript: person.lastConversation || '',
            topics: person.lastTopics || []
          });
        }
      }

      // Ensure dates are Date objects
      if (person.lastMet && typeof person.lastMet === 'string') {
        person.lastMet = new Date(person.lastMet);
      }

      person.conversationHistory = person.conversationHistory.map((conv: any) => ({
        ...conv,
        date: conv.date instanceof Date ? conv.date : new Date(conv.date)
      }));

      await supabaseClient.storePerson(person);
      console.log(`  ✓ Migrated ${person.name} with ${person.conversationHistory.length} conversation(s)`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate ${person.name}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('Migration Complete!');
  console.log('═'.repeat(50));
  console.log(`✓ Successfully migrated: ${successCount} people`);
  if (errorCount > 0) {
    console.log(`❌ Failed to migrate: ${errorCount} people`);
  }

  // Display final stats
  console.log('\nFetching statistics from Supabase...');
  try {
    const stats = await supabaseClient.getStatsAsync();
    console.log('\n📊 Database Statistics:');
    console.log('─────────────────────────────────────────────────');
    console.log(`  Total People: ${stats.totalPeople}`);
    console.log(`  Total Conversations: ${stats.totalConversations}`);
    console.log(`  People with Voice References: ${stats.peopleWithVoices}`);
    console.log(`  Avg Conversations per Person: ${stats.averageConversationsPerPerson.toFixed(1)}`);
    console.log('─────────────────────────────────────────────────\n');
  } catch (error) {
    console.error('Failed to fetch statistics:', error);
  }

  // Create backup of original file
  const backupPath = DATA_FILE.replace('.json', `.backup-${Date.now()}.json`);
  console.log(`Creating backup of original file: ${backupPath}`);
  fs.copyFileSync(DATA_FILE, backupPath);
  console.log('✓ Backup created\n');

  console.log('✅ Migration completed successfully!');
  console.log('   You can now use the Supabase-backed companion UI.\n');
}

// Run migration
main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
