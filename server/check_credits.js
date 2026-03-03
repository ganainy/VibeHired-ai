const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
    const user = await User.findOne({ email: 'amrmohammedali11@gmail.com' });
    if (!user) {
        console.error('User not found');
        process.exit(1);
    }
    const UsageRecord = mongoose.model('UsageRecord', new mongoose.Schema({
        userId: mongoose.Schema.Types.ObjectId,
        credits: { limit: Number, used: Number }
    }));
    const record = await UsageRecord.findOne({ userId: user._id });
    console.log('Result:', JSON.stringify({
        email: user.email,
        limit: record.credits.limit,
        used: record.credits.used,
        remaining: record.credits.limit - record.credits.used
    }, null, 2));
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
