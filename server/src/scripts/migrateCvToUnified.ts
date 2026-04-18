import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env before importing models
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

import CV from '../models/CV';
import { normalizeFreeformCvTags } from '../utils/vhTagNormalizer';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/job-app-assistant';

const migrate = async () => {
    console.log(`Connecting to MongoDB at ${MONGODB_URI.split('@').pop()}`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB. Starting migration...');

    const cvs = await CV.find({});
    let migratedCount = 0;

    for (const cv of cvs) {
        if (!cv.cvJson) continue;
        
        let needsUpdate = false;
        let currentJson = cv.cvJson as any;

        // If it looks like JsonResume, adapt to unified freeform
        if (currentJson.basics && (currentJson.work !== undefined || currentJson.education !== undefined)) {
            console.log(`Migrating CV ${cv._id} (${cv.filename || 'unnamed'})`);
             
            // Map basics -> Personal Info
            const newJson: any = {
                'Personal Info': currentJson.basics,
                ...currentJson
            };
            delete newJson.basics;

            // Simple map of arrays to better titles if needed, but existing work/education names work.
            // If they are lowercase, we capitalize them for better UI display
            const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
            
            for (const key of ['work', 'education', 'skills', 'projects', 'languages', 'certificates', 'awards', 'volunteer', 'interests', 'references']) {
                 if (newJson[key]) {
                      newJson[capitalize(key)] = newJson[key];
                      delete newJson[key];
                 }
            }

            if (!newJson.__vh_tags) newJson.__vh_tags = {};

            // Add standard tags
            newJson.__vh_tags['Personal Info'] = 'contact_block';
            
            // Normalize all remaining fields
            currentJson = normalizeFreeformCvTags(newJson, { headerKey: 'Personal Info' });
            cv.cvJson = currentJson;
            needsUpdate = true;
        }

        // Normalize templateId to ats-optimized
        if (cv.templateId === 'modern-clean' || cv.templateId === 'ats-optimized' || !cv.templateId) {
            cv.templateId = 'ats-optimized';
            needsUpdate = true;
        }

        if (needsUpdate) {
            await cv.save();
            migratedCount++;
        }
    }

    console.log(`Migration complete. Migrated ${migratedCount} CVs to the unified freeform schema.`);
    process.exit(0);
};

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
