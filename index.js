const express = require('express')
const bodyParser = require('body-parser')
const Bot = require('messenger-bot')
const mongoose = require('mongoose');
const apiAi = require('apiai');
const User = require('./models/User');
const HTTPRequest = require('request');
const nodeMarket = require('node-markitondemand');


const checkExchange = 'NYSENASDAQTSE';

var errors = {
    'COULD_NOT_FIND_STOCK': `Sorry! We couldn't find that stock. Please Try again.`
}

var alias = {
    'Alphabet': 'Google'
}

var responses = {
    'INITIAL_START': {
        '1': `Hi! I'm TrackThat. I help you track your stock portfolio by providing updates and insight.`,
        '2': `Let's begin! Search for a stock by it's symbol (AAPL) or it's name (Apple).`
    },
    'DEFAULT': {
        '1': `I'm not sure about that request. You can view your portfolio, add Stocks to your portfolio or view news. Type Help for more information!`
    },
    'ADDING_STOCK': {
        '1': `Add a stock by typing its stock symbol (AAPL) or name (Apple).`
    },
    'CANCEL_ACTION': {
        '1': `Cancelling action. Type Help to find out what you can do.`
    }
}

var status = {
    'PICKING_STOCK': 'PICKING_STOCK',
    'DEFAULT': 'DEFAULT'
}

var apiAiApp = apiAi(process.env.APIAI_TOKEN);
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('error', function() {
    console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
});

var bot = new Bot({
    token: process.env.APP_TOKEN,
    verify: process.env.APP_VERIFY,
    app_secret: process.env.APP_SECRET
})

var app = express();


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
    extended: true
}))
app.set('port', (process.env.PORT || 5000))


app.get('/', (req, res) => {
    return bot._verify(req, res)
})

app.post('/', (req, res) => {
    bot._handleMessage(req.body)
    res.end(JSON.stringify({ status: 'ok' }))
})

app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})


bot.on('error', (err) => {
    console.log(err.message)
})

bot.on('postback', (payload, reply) => {
    const postbackContent = payload.postback.payload;
    if (postbackContent.indexOf('STOCK') != -1) {
        if (postbackContent.indexOf('CONFIRM') != -1) {
            User.update({ sender: payload.sender.id }, { $set: { status: status.DEFAULT }, $addToSet: { stocks: payload.postback.payload.split('_')[2] } }, (err) => {
                handleError(err);
                reply({ text: `Added ${payload.postback.payload.split('_')[2]} to the portfolio.` }, (err) => {
                    handleError(err);
                });
            });
        } else {
            reply({ text: `Please type in the Stock Symbol or Company name again.` }, (err) => { handleError(err) });
        }
    }
});

bot.on('message', (payload, reply) => {
    var id = payload.sender.id;
    var text = payload.message.text;
    User.findOne({ sender: id }, (err, user) => {
        handleError(err);
        if (user) {
            stateManager(id, user, reply, text);
        } else {
            var newUser = new User({
                sender: id
            })
            newUser.save((err, user) => {
                handleError(err);
                stateManager(id, user, reply, text);
            });
        }
    });
});

function actionManager(res, reply, id) {
    console.log(res);
    const action = (res.result.action) ? res.result.action : 'NO_ACTION';
    const parameters = (res.result.parameters) ? res.result.parameters : 'NO_PARAMS';

    switch (action) {
        case 'portfolio.open':
            User.findOne({ sender: id }, (err, user) => {
                showPortfolio(user, reply);
            });
            break;
        case 'stocks.add':
            reply({ text: responses['ADDING_STOCK']['1'] }, (err) => {
                handleError(err);
                updateUser(id, { status: status.PICKING_STOCK }, (err) => {
                    handleError(err);
                });
            });
            break;
        default:
            reply({ text: responses['DEFAULT']['1'] }, (err) => { handleError(err) });
            break;
    }
}

function stateManager(id, user, reply, text) {
    var query = apiAiApp.textRequest(text);
    query.on('response', (res) => {
        if (res.result.action === 'cancel.action') {
            reply({ text: responses['CANCEL_ACTION']['1'] }, (err) => {
                handleError(err);
                updateUser(id, { status: status.DEFAULT }, (err) => {
                    handleError(err);
                });
            })
        } else {
            switch (user.status) {
                case 'INITIAL':
                    handleInitial(id, reply, text);
                    break;
                case 'PICKING_STOCK':
                    determineStock(text, reply, id);
                    break;
                case 'DEFAULT':
                    actionManager(res, reply, id);
                    break;
                default:
                    reply({ text: responses['DEFAULT']['1'] }, (err) => { handleError(err) });
                    break;
            }
        }
    });
    query.on('error', (err) => { handleError(err) });
    query.end();
}

function showPortfolio(user, reply) {
    nodeMarket.getQuotes(user.stocks, (err, data) => {
        if (data) {
            for (var set = 0; set < Math.ceil(user.stocks.length / 10); set++) {
                var mainCounter = 0;
                var cards = [];
                for (var eachCard = mainCounter * 10; eachCard < (mainCounter + 1) * 10; eachCard++) {
                    if (data[eachCard]) {
                        console.log(data[eachCard]);
                    //     cards.push({
                    //         "title": data[eachCard].t,
                    //         "subtitle": data[eachCard].e

                    //         // "subtitle": allEvents.events[i].description.text,
                    //         // "image_url": (allEvents.events[i].logo) ? allEvents.events[i].logo.url : ''
                    //         // "buttons": [{
                    //         //     "type": 'web_url',
                    //         //     "url": allEvents.events[i].url,
                    //         //     "title": 'Event Page'
                    //         // }, {
                    //         //     "type": 'postback',
                    //         //     "title": 'Short Description',
                    //         //     "payload": `DESCRIBE_${allEvents.events[i].resource_uri}`
                    //         // }]
                    //     });
                    // }
                }
                // reply({
                //     attachment: {
                //         "type": "template",
                //         "payload": {
                //             "template_type": "generic",
                //             "elements": cards
                //         }
                //     }
                // }, (err) => { handleError(err) });
                mainCounter++;
            }
        }
    });

}

function handleInitial(id, reply, text) {
    reply({ text: responses['INITIAL_START']['1'] }, (err) => {
        handleError(err);
        reply({ text: responses['INITIAL_START']['2'] }, (err) => {
            handleError(err);
            updateUser(id, { status: status.PICKING_STOCK });
        });
    })
}

function determineStock(text, reply, id) {
    for (stock in alias) {
        if (alias[stock] === text) text = stock;
    }
    HTTPRequest(parseYahooUrl(text), function(error, response, body) {
        if (!error && response.statusCode == 200 && JSON.parse(body).ResultSet.Result.length > 0) {
            for (var i = 0; i < JSON.parse(body).ResultSet.Result.length; i++) {
                if (checkExchange.indexOf(JSON.parse(body).ResultSet.Result[i].exchDisp) != -1) {
                    confirmStock(JSON.parse(body).ResultSet.Result[i], reply);
                    return;
                }
            }
            replyError(reply, errors['COULD_NOT_FIND_STOCK']);
        } else {
            replyError(reply, errors['COULD_NOT_FIND_STOCK']);
        }
    });
}

function confirmStock(stockData, reply) {
    const confirm = {
        "type": "template",
        "payload": {
            "template_type": "button",
            "text": `Did you mean ${stockData.name} (${stockData.symbol}), listed on the ${stockData.exchDisp}?`,
            "buttons": [{
                "type": "postback",
                "title": "YES",
                "payload": `CONFIRM_STOCK_${stockData.symbol}`
            }, {
                "type": "postback",
                "title": "NO",
                "payload": `INCORRECT_STOCK`
            }]
        }
    }
    reply({ attachment: confirm }, (err) => {
        handleError(err);
    });
}


function replyError(reply, text) {
    reply({ text }, (err) => { handleError(err) });
}

function parseYahooUrl(text) {
    return `http://d.yimg.com/autoc.finance.yahoo.com/autoc?query=${text}&region=1&lang=en`
}

function updateUser(id, set) {
    User.update({ sender: id }, { $set: set }, (err) => { handleError(err) });
}

function handleError(err) {
    if (err) {
        console.log(err);
        throw err;
    }
}
