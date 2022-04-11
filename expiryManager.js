const cron = require('cron');
const fs = require('fs');

module.exports = () => {
    const img = cron.job(`* * * * *`, /*runs every minute*/ async () => {
        console.log(`Checking for pending file deletions...`)
        
        const allImages = await seq.models.Image.findAll();

        const images = allImages.filter(img => {
            const timeUntilDue = img.due - Date.now()
            if(timeUntilDue <= 60000) return true
            else return false;
        });

        const func = (i) => {
            seq.models.Image.destroy({
                where: {
                    messageID: i.messageID,
                    due: i.due,
                    imageName: i.imageName
                }
            }).then(r => {
                console.log(`Successfully removed db entry for ${i.messageID}-${i.imageName}`)
                fs.rm(i.location, () => console.log(`Removed image ${i.messageID}-${i.imageName}`));
            }).catch(e => {
                console.error(`Unable to remove DB entry for ${i.messageID}-${i.imageName}`, e)
            });
        }
        
        for(i of images) {
            const timeUntilDue = i.due - Date.now()
            console.log(`> image ${i.messageID}-${i.imageName} is due in less than a minute (${timeUntilDue/1000}s)`);
            if(timeUntilDue <= 0) {func(i)} else setTimeout(func, timeUntilDue, i)
        }
    }); img.start()
}