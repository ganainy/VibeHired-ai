const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
    const user = await User.findOne({ email: 'amrmohammedali11@gmail.com' });
    if (!user) {
        process.exit(1);
    }
    const UsageRecord = mongoose.model('UsageRecord', new mongoose.Schema({
        userId: mongoose.Schema.Types.ObjectId,
        billingPeriodStart: Date,
        billingPeriodEnd: Date,
        credits: { limit: Number, used: Number }
    }));
    const records = await UsageRecord.find({ userId: user._id });
    console.log('Records:', JSON.stringify(records, null, 2));
    process.exit(0);
}

run().catch(err => {
    process.exit(1);
});
