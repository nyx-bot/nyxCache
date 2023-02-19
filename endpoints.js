const superagent = require('superagent');

const { Op } = require('sequelize')

const fs = require('fs')

let fileDeleteTime = 2628000000.00288 // 365/12 to ms

const hwAccelEnabled = fs.existsSync(`/dev/dri/renderD128`)
//const hwAccelEnabled = false

module.exports = () => new Promise(async res => {
    const useragent = `Mozilla/5.0 (X11; CrOS aarch64 14318.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4685.4 Safari/537.36`
    // copied this from my chromebook lol

    const express = require('express')();
    const bodyParser = require('body-parser');
    //express.use(require(`express`).json());
    express.use(bodyParser.json({ limit: '20mb' }))
    //express.use(express.urlencoded({ limit: '20mb' }));

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
        const r = req.body;
        if(typeof r !== `object`) return res.status(500).send(`Body is not parsed as an object.`)
        if(!r.url) return res.status(400).send(`Missing url body parameter.`);

        res.writeHead(200)

        const url = r.url.split(`?`)[0];
        const buf = r.image && typeof r.image == `object` && r.image.type == `Buffer` && r.image.data ? Buffer.from(r.image.data) : null;
        const messageID = url.split(`/`).slice(-2)[0];
        const fileName = url.split(`/`).slice(-1)[0].split(`.`).slice(0, -1)[0];
        const fileType = url.split(`.`).slice(-1)[0];

        if(!fs.existsSync(`./cache/attachments`)) {
            console.log(`Creating attachments dir...`)
            fs.mkdirSync(`./cache/attachments`)
        }

        const entry = await global.seq.models.Image.findOne({
            where: {
                messageID,
                imageName: `${fileName}.${fileType}`
            }
        });

        console.log(`Existing DB entry: ${entry ? true : false}`)

        let getUrl = url;
        if(fileType.match(/(png|jpg|jpeg|gif)/)) getUrl = url + `${url.includes(`discord`) ? `?size=2048` : ``}`

        console.log(`Saving media "${fileName}":\n  URL: ${getUrl}\n  Type: ${fileType}`);

        if(fs.existsSync(`./cache/attachments/${messageID}-${fileName}.${fileType}`)) {
            console.log(`File previously existed; removing...`)
            await new Promise(res => fs.rm(`./cache/attachments/${messageID}-${fileName}.${fileType}`, res));
        };

        const getRequest = () => buf ? (require('stream')).Readable.from(buf) : superagent.get(getUrl).set(`User-Agent`, useragent);

        const ffprobeProc = require('child_process').spawn(`ffprobe`, [`-i`, getUrl, `-v`, `quiet`, `-print_format`, `json`, `-show_format`, `-show_streams`]);

        let ffprobeResult = ``;

        ffprobeProc.stdout.on(`data`, d => ffprobeResult += d.toString().trim())

        ffprobeProc.stdin.pipe(getRequest())

        ffprobeProc.on(`close`, async code => {
            console.log(`FFprobe finished with code ${code}`);

            const saveRawFile = async (request) => {
                if(!request) request = getRequest()
                
                const writeStream = fs.createWriteStream(`./cache/attachments/${messageID}-${fileName}.${fileType}`);
                
                writeStream.on(`finish`, () => {
                    console.log(`Media fetched successfully!`);
        
                    res.end(`Cached!`)
        
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
                });
        
                try {
                    request.pipe(writeStream);
                } catch(e) {
                    console.error(e)
                    
                    if(entry) {
                        seq.models.Image.destroy({
                            where: {
                                messageID: entry.dataValues.messageID,
                                due: entry.dataValues.due,
                                imageName: entry.dataValues.imageName
                            }
                        });
        
                        res.send(`Internal Error.`)
                    }
                }
            }

            if(ffprobeProc && ffprobeProc.stdout) {
                try {
                    const o = JSON.parse(ffprobeResult)

                    const codecTypes = {
                        video: o.streams.find(o => o.codec_type == `video`) ? true : false,
                        audio: o.streams.find(o => o.codec_type == `audio`) ? true : false
                    }

                    if(codecTypes.video) {
                        codecTypes.width = o.streams.find(o => o.codec_type == `video`).width;
                        codecTypes.height = o.streams.find(o => o.codec_type == `video`).height;

                        if(o.streams.find(o => o.codec_type == `video`).bit_rate) codecTypes.vbr = Number(o.streams.find(o => o.codec_type == `video`).bit_rate)
                        if(o.streams.find(o => o.codec_type == `video`).codec_name) codecTypes.vcodec = o.streams.find(o => o.codec_type == `video`).codec_name
                    };

                    if(codecTypes.audio) {
                        if(o.streams.find(o => o.codec_type == `audio`).sample_rate) codecTypes.asr = Number(o.streams.find(o => o.codec_type == `audio`).sample_rate)
                        if(o.streams.find(o => o.codec_type == `audio`).bit_rate) codecTypes.abr = Number(o.streams.find(o => o.codec_type == `audio`).bit_rate)
                        if(o.streams.find(o => o.codec_type == `audio`).codec_name) codecTypes.acodec = o.streams.find(o => o.codec_type == `audio`).codec_name
                    }

                    console.log(`Data:\n- ${Object.entries(codecTypes).map(o => `${o[0]}: ${o[1]}`).join(`\n- `)}`);

                    if(require(`./config.json`).enableCompression) {
                        let ffmpegArgs = [];
    
                        if(codecTypes.video) {
                            ffmpegArgs.push(`-vcodec`, ...(hwAccelEnabled ? [`h264_vaapi`, `-profile`, `578`] : [`h264`, `-profile`, `baseline`]), `-r`, `30`, );
    
                            let filter = [];
    
                            const maxRes = 640, maxBitrate = 2000
    
                            if(codecTypes.width && codecTypes.height && (codecTypes.width > maxRes || codecTypes.height > maxRes)) {
                                if(codecTypes.width > codecTypes.height) {
                                    const reduction = Math.round(codecTypes.width/maxRes);
                                    filter.push(`scale=${maxRes}:${codecTypes.height/reduction}`)
                                } else if(codecTypes.width < codecTypes.height) {
                                    const reduction = Math.round(codecTypes.height/maxRes);
                                    filter.push(`scale=${codecTypes.width/reduction}:${maxRes}`)
                                };
                            }
    
                            if(codecTypes.vbr > maxBitrate) {
                                ffmpegArgs.push(`-b:v`, `${maxBitrate}k`)
                            } else {
                                ffmpegArgs.push(`-b:v`, `${codecTypes.vbr}k`)
                            }

                            if(hwAccelEnabled) {
                                ffmpegArgs.push(`-filter_hw_device`, `foo`);
                                filter.push(`format=nv12`, `hwupload`)
                            }
    
                            if(filter && filter.length > 0) ffmpegArgs.push(`-filter:v`, filter.join(`,`))
                        };
                        
                        if(codecTypes.audio) {
                            ffmpegArgs.push(`-acodec`, `mp3`);
    
                            if(codecTypes.asr > 44100) ffmpegArgs.push(`-ar`, `44100`)
                            if(codecTypes.abr > 64000) ffmpegArgs.push(`-b:a`, `64000`)
                        };
    
                        if(ffmpegArgs.length > 0) {
                            let outputFormat = o.format.format_name.split(`,`).find(s => s == getUrl.split(`.`).slice(-1)[0]);
                            if(!outputFormat) outputFormat = o.format.format_name.split(`,`)[0];
    
                            outputFormat = `ismv`
    
                            const useArgs = [`-i`, getUrl, ...ffmpegArgs, `-f`, outputFormat, `-`, /*`-loglevel`, `error`,*/ `-hide_banner`];

                            if(hwAccelEnabled) {
                                useArgs.unshift(`-init_hw_device`, `vaapi=foo:/dev/dri/renderD128`, /*`-hwaccel`, `vaapi`, `-hwaccel_device`, `foo`*/);
                                useArgs.splice(useArgs.indexOf(`-`)+1, 0, `-hwaccel_output_format`, `vaapi`)
                            }
    
                            console.log(`Spawning FFmpeg with args:\n- ${useArgs.map(s => s.includes(` `) ? `"${s}"` : s).join(` `)}`)
    
                            const ffmpeg = require('child_process').spawn(`ffmpeg`, useArgs);
    
                            saveRawFile(ffmpeg.stdout);
    
                            ffmpeg.stderr.on(`data`, d => console.log(`FFMPEG: ${d.toString().trim().split(`\n`).join(`\nFFMPEG: `)}`))
    
                            ffmpeg.on(`close`, (code) => console.log(`FFmpeg has completed with code ${code}`))
                            ffmpeg.on(`error`, (e) => console.log(`FFmpeg has exited with error:`, e))
                        } else return saveRawFile()
                    } else return saveRawFile()
                } catch(e) {
                    console.warn(`Failed on ffprobe parsing: ${e}`);
                    saveRawFile()
                }
            } else saveRawFile();
        })
    });

    express.listen(8096)

    res(express);
})
