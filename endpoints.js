const superagent = require('superagent');

const { Op } = require('sequelize')

const fs = require('fs')

let fileDeleteTime = 2628000000.00288 // 365/12 to ms

module.exports = () => new Promise(async res => {
    const useragent = `Mozilla/5.0 (X11; CrOS aarch64 14318.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4685.4 Safari/537.36`
    // copied this from my chromebook lol

    const express = require('express')();
    express.use(require(`express`).json());

    express.get(`/media/:messageID/:filename`, (req, res) => {
        seq.models.Image.findOne({where: {
            messageID: req.params.messageID,
            [Op.or]: [
                {
                    relativeName: req.params.filename
                },
                {
                    imageName: req.params.filename
                },
            ]
        }}).then(r => {
            if(r && r.dataValues) {
                res.sendFile(`${__dirname}/${r.dataValues.location}`)
            } else {
                return res.status(404).send(404)
            }
        })
    })

    // and now we create the caching shit

    express.use(require('./core/authenticator'));

    express.post(`/saveFile`, async (req, res) => {
        res.send(`Caching!`)
        const r = req.body;
        if(typeof r !== `object`) return res.status(500).send(`Body is not parsed as an object.`)
        if(!r.url) return res.status(400).send(`Missing url body parameter.`);

        const url = r.url.split(`?`)[0];
        const messageID = url.split(`/`).slice(-2)[0];
        const fileName = url.split(`/`).slice(-1)[0].split(`.`).slice(0, -1)[0];
        const fileType = url.split(`.`).slice(-1)[0];

        const entry = await global.seq.models.Image.findOne({
            where: {
                messageID,
                imageName: `${fileName}.${fileType}`
            }
        });

        console.log(`Existing DB entry: ${entry ? true : false}`)

        let getUrl = url;
        if(fileType.match(/(png|jpg|jpeg|gif)/)) getUrl = url + `${url.includes(`discord`) ? `?size=2048` : ``}`

        console.log(`Saving media "${fileName}":\n  URL: ${getUrl}\n  Type: ${fileType}`)

        superagent.get(getUrl).set(`User-Agent`, useragent).then(async r => {
            console.log(`Media fetched successfully!`)
            if(!fs.existsSync(`./cache/attachments`)) {
                console.log(`Creating attachments dir...`)
                fs.mkdirSync(`./cache/attachments`)
            }
            if(fs.existsSync(`./cache/attachments/${messageID}-${fileName}.${fileType}`)) {
                console.log(`File previously existed; removing...`)
                await new Promise(res => fs.rm(`./cache/attachments/${messageID}-${fileName}.${fileType}`, res));
            };
	        console.log(typeof r.body)
            fs.writeFile(`./cache/attachments/${messageID}-${fileName}.${fileType}`, r.body, async () => {
                console.log(`Successfully wrote file!`);

                const deleted = delete r.body;
                console.log(deleted ? `Hopefully cleared buffer from memory` : `"delete" call returned false... ohno`)

                if(entry) {
                    console.log(`Entry already exists for ${messageID}-${fileName}; updating the expiry date..`)
                    entry.update({
                        due: Date.now() + fileDeleteTime
                    }).then(r => console.log(`...done!`));
                    return
                } else {
                    console.log(`Creating new DB entry...`)
                    seq.models.Image.create({
                        location: `./cache/attachments/${messageID}-${fileName}.${fileType}`,
                        origin: url,
                        due: Date.now() + fileDeleteTime,
                        messageID,
                        imageName: `${fileName}.${fileType}`,
                        relativeName: `${fileName}`
                    }).then(r => {
                        console.log(`...done!\nSaved as:\n| ${Object.entries(r.dataValues).map(a => `${a[0]}: ${a[1]}`).join(`\n| `)}`)
                    });
                    return;
                }
            })
        })
    });

    express.listen(8096)

    res(express);
})
