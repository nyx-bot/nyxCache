const { DataTypes, Op } = require('sequelize');

module.exports = {
    location: {
        // relative location; one that can be fetched from this directory.
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: `./res/null.png`
        // ^ default value, as it's just a null image.
    },
    origin: {
        // the original URL that the image came from.
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: require('../config.json').locations.nullImage
        // again, default value bc null
    },
    due: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    messageID: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: `0`
    },
    imageName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: `image.jpg`
    },
    relativeName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: `image`
    }
}