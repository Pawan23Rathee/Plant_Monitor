// cron/reminderWorker.js
const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const Plant = require('../models/Plant');

// For production: integrate web-push or send SMS via Twilio. Here we just log.
module.exports = {
  start: function(){
    // run every minute (dev). For production maybe every 5-15 minutes.
    cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        const due = await Reminder.find({ nextAt: { $lte: now } });
        for(const r of due){
          const plant = await Plant.findById(r.plantId);
          console.log(`[Reminder] ${plant ? plant.name : 'Unknown'} — ${r.type} — note:${r.note}`);
          // TODO: send push notification via web-push (browser subscription) or SMS

          if(r.repeatDays && r.repeatDays > 0){
            r.nextAt = new Date(new Date(r.nextAt).getTime() + r.repeatDays * 24*60*60*1000);
            await r.save();
          } else {
            await Reminder.findByIdAndDelete(r._id);
          }
        }
      } catch(err) { console.error('Reminder worker error', err); }
    });
    console.log('Reminder worker started (cron)');
  }
};
