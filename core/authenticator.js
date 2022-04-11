module.exports = (req, res, next) => {
    const authKey = require('../config.json').authorization

    let pass = (key) => {
        if(key == authKey) {
            console.log(`${req.fullUrl}: authKey valid!`)
            next()
        } else {
            console.log(`${req.fullUrl}: authKey invalid.`)
            res.status(401).send(`Invalid authorization key.`)
        }
    }

    pass(req.headers.authKey || req.headers.authorization || req.headers.auth || req.headers.key || `nope`)
};