const fs = require('fs')

const { Sequelize } = require('sequelize');

if(!fs.existsSync(`./cache/`)) fs.mkdirSync(`./cache/`)

const seq = new Sequelize({
    dialect: `sqlite`,
    storage: `cache/entries.db`,
    logging: null,
}); global.seq = seq; seq.authenticate().then(async () => {
    console.log(`DB set up successfully!`);

    const definitions = fs.readdirSync(`./dbDefinitions/`);

    for (n of definitions) {
        const definition = n.split('.js');
        const name = `${definition[0][0].toUpperCase()}${definition[0].slice(1)}`;
        const def = require(`./dbDefinitions/${n}`)
        if(typeof def == `object`) {
            console.log(`Defining ${name}...`)
            seq.define(name, def)
        } else {
            console.error(`Table "${name}" is not of type object!`)
        }
    }

    // sync db if not up to date
    await (require('./dbSync'));

    const app = await require('./endpoints')();

    require('./expiryManager')()
}).catch(e => {
    console.error(e); process.exit(1)
})