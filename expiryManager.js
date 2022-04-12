const fs = require('fs');

const { Op } = require('sequelize')

const handle = () => {
    console.log(`Checking for pending file deletions...`);

    seq.models.Image.findAll({
        where: {
            due: {
                [Op.lte]: Date.now() + 60000
            }
        }
    }).then(async images => {
        console.log(images.length + ` files pending deletion!`)

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
}

module.exports = () => {
    setInterval(handle, 60000); handle();

    //seq.models.Image.findAll({raw: true}).then(res => console.log(res.sort((a, b) => a.due - b.due).map(a => require('./util/timeParser')(a.due - Date.now())).map(r => r.string)))
    // ^ used to find the earliest due; debug
}