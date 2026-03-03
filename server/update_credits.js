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
    await UsageRecord.findOneAndUpdate({ userId: user._id }, { $set: { 'credits.limit': 10000 } });
    console.log('Successfully set 10,000 credits for:', user.email);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
