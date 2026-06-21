require('dotenv').config({ path: 'c:\\Users\\Tarun Siddappagoudar\\smart-exam-platform\\backend\\.env' });
const mongoose = require('mongoose');
const AuditLog = require('../backend/src/models/AuditLog');

const primaryURI = process.env.MONGO_URI;
console.log('Connecting to:', primaryURI);

mongoose.connect(primaryURI)
    .then(async () => {
        console.log('Connected to DB');
        try {
            const logs = await AuditLog.find().lean();
            console.log(`Found ${logs.length} audit logs:`);
            logs.forEach(log => {
                console.log(`ID: ${log._id}, merkleRoot: ${log.merkleRoot}, txHash: ${log.txHash}, status: ${log.status}`);
            });
        } catch (err) {
            console.error('Error:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
