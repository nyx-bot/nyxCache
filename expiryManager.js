const fs = require('fs');

const { Op } = require('sequelize')

module.exports = () => {
    setInterval(() => {
        console.log(`Checking for pending file deletions...`);

        seq.models.Image.findAll({
            where: {
                due: {
                    [Op.lte]: Date.now() + 60000
                }
            }
        }).then(async images => {
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
                    console.error(`Unable to remove DB entry for ${i.messageID}-${i.imageName}`, e);
                    fs.rm(i.location, () => console.log(`Removed image ${i.messageID}-${i.imageName}`));
                });
            }
            
            for(i of images) {
                const timeUntilDue = i.due - Date.now()
                console.log(`> image ${i.messageID}-${i.imageName} is due in less than a minute (${timeUntilDue/1000}s)`);
                if(timeUntilDue <= 0) {func(i)} else setTimeout(func, timeUntilDue, i)
            }
        })

        //const images = allImages.filter(img => {
        //    const timeUntilDue = img.due - Date.now()
        //    if(timeUntilDue <= 60000) return true
        //    else return false;
        //});
    }, 60000)
}