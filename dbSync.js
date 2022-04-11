const fs = require('fs')

module.exports = new Promise(async (finish, rej) => {
    let models = Object.entries(seq.models);
    const modelsCacheDir = `${__dirname}/cache/modelsCache.json`;
    if(!fs.existsSync(modelsCacheDir.replace('/modelsCache.json', ``))) {fs.mkdirSync(modelsCacheDir.replace('/modelsCache.json', ``))}
    if(!fs.existsSync(modelsCacheDir)) {fs.writeFileSync(modelsCacheDir, `{}`)};
    const modelsCache = JSON.parse(fs.readFileSync(modelsCacheDir));
    a = (model) => new Promise(async (res, rej) => {
        if(modelsCache[model] && JSON.stringify(modelsCache[model]) !== JSON.stringify(seq.models[model].build())) {
            console.error(`┃ Model ${model} has not been synchronized yet!`);
            await seq.models[model].sync({alter: true}).then(a => {res(console.log(`┃ Synchronized ${model}!`))}).catch(e => {
                res(console.error(`┃ Failed to set up ${model};`, e))
            });
        } else {
            await seq.models[model].findOne({where: seq.models[model].build(), raw: true,}).then(a => {res()}).catch(async e => {
                console.error(`┃ Model ${model} has not been synchronized yet!`);
                await seq.models[model].sync({alter: true}).then(a => {res(console.log(`┃ Synchronized ${model}!`))}).catch(e => {
                    res(console.error(`┃ Failed to set up ${model};`, e))
                });
            });
        };
        modelsCache[model] = seq.models[model].build();
    });
    console.log(`┃ Testing DB models`)
    for(i in models) {
        let model = models[i][0];
        await a(model)
    };
    fs.writeFileSync(modelsCacheDir, JSON.stringify(modelsCache))
    return finish(console.log(`┃ Successfully synchronized DB!`));
});