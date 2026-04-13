/**
 * Script to clear Gmail OAuth tokens for all users.
 * This forces users to re-authenticate with the new scopes (including gmail.modify).
 * 
 * Run with: npx ts-node scripts/clear-gmail-tokens.ts
 */

import mongoose from 'mongoose';
import Profile from '../src/models/Profile';
import { env } from '../src/config/env';

async function clearGmailTokens() {
  try {
    // Connect to database
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all profiles with Gmail tokens
    const profiles = await Profile.find({
      'integrations.google.accessToken': { $ne: null }
    });

    console.log(`Found ${profiles.length} profile(s) with Gmail tokens`);

    if (profiles.length === 0) {
      console.log('No tokens to clear. Exiting.');
      process.exit(0);
    }

    // Clear tokens for each profile
    let clearedCount = 0;
    for (const profile of profiles) {
      await Profile.updateOne(
        { _id: profile._id },
        {
          $set: {
            'integrations.google.accessToken': null,
            'integrations.google.refreshToken': null,
            'integrations.google.email': null,
            'integrations.google.enabled': false,
          }
        }
      );
      clearedCount++;
      console.log(`✓ Cleared tokens for user: ${profile.userId}`);
    }

    console.log(`\n✅ Successfully cleared tokens for ${clearedCount} user(s)`);
    console.log('Users will need to re-authenticate with the new gmail.modify scope on next use.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearGmailTokens();
