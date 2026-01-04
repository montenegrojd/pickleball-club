#!/usr/bin/env node

/**
 * Migration script to copy data from JSON file storage to Firestore
 * 
 * Usage:
 *   1. Set environment variables for Firestore (see .env.local)
 *   2. Run: node scripts/migrate-to-firestore.js [filename]
 *   
 * Examples:
 *   node scripts/migrate-to-firestore.js              // Uses db.json
 *   node scripts/migrate-to-firestore.js db-template.json
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Read JSON database - use command line arg or default to db.json
const filename = process.argv[2] || 'db.json';
const DB_PATH = path.join(process.cwd(), 'data', filename);

if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Error: File not found: ${DB_PATH}`);
    process.exit(1);
}

console.log(`📁 Reading data from: ${filename}\n`);
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

// Initialize Firestore
initializeApp();
const db = getFirestore();

async function migrate() {
    console.log('🚀 Starting migration to Firestore...\n');

    // Migrate Players
    console.log(`📊 Migrating ${data.players.length} players...`);
    const playerBatch = db.batch();
    for (const player of data.players) {
        const ref = db.collection('players').doc(player.id);
        playerBatch.set(ref, player);
    }
    await playerBatch.commit();
    console.log('✅ Players migrated\n');

    // Migrate Matches
    console.log(`🏓 Migrating ${data.matches.length} matches...`);
    const matchBatch = db.batch();
    for (const match of data.matches) {
        const ref = db.collection('matches').doc(match.id);
        matchBatch.set(ref, match);
    }
    await matchBatch.commit();
    console.log('✅ Matches migrated\n');

    // Migrate Sessions
    console.log(`📅 Migrating ${data.sessions.length} sessions...`);
    const sessionBatch = db.batch();
    for (const session of data.sessions) {
        const ref = db.collection('sessions').doc(session.id);
        sessionBatch.set(ref, session);
    }
    await sessionBatch.commit();
    console.log('✅ Sessions migrated\n');

    console.log('🎉 Migration complete!');
    console.log(`\nMigrated:`);
    console.log(`  - ${data.players.length} players`);
    console.log(`  - ${data.matches.length} matches`);
    console.log(`  - ${data.sessions.length} sessions`);
}

migrate()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
