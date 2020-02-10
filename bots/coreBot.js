const axios = require('axios');
const { ActivityHandler, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');

class CoreBot extends ActivityHandler {
    constructor(config) {
        super();

        const botRecognizer = new LuisRecognizer(config,
            {
                includeAllIntents: true,
                includeInstanceData: true
            }, true);

        this.onMessage(async (context, next) => {
            console.log('Processing Message Activity.');

            const recognizerResult = await botRecognizer.recognize(context);

            // Top intent tell us which cognitive service to use.
            const intent = LuisRecognizer.topIntent(recognizerResult);
            // Next, we call the dispatcher with the top intent.
            await this.dispatchToTopIntentAsync(context, intent, recognizerResult);

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const welcomeText = 'Why not asking a question about the weather in your city?';
            const { membersAdded } = context.activity;

            for (const member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await context.sendActivity(`Welcome to Sobota. ${ welcomeText }`);
                }
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    // Dispatch recognized intent to its appropriate function
    async dispatchToTopIntentAsync(context, intent, recognizerResult) {
        switch (intent) {
        case 'GetWeather':
            await this.getWeather(context, recognizerResult.luisResult);
            break;
        case 'None':
            await context.sendActivity('I can\'t understand this yet, but I\'m learning, sorry!');
            break;
        default:
            console.log(`Dispatch unrecognized intent: ${ intent }.`);
            await context.sendActivity('Sorry, for now I can\'t understand that request.');
            break;
        }
    }

    // Use OpenWeatherMap API to get weather information for one or more cities
    async getWeatherInfos(cities) {
        const promises = [];

        for (let i = 0; i < cities.length; i += 1) {
            const url = `http://api.openweathermap.org/data/2.5/weather?q=${ cities[i] }&appid=${ process.env.OpenWeatherMapAPI }&units=metric`;
            promises.push(axios.get(url).catch((error) => {
                console.log(error.response);
            }));
        }

        const response = [];

        try {
            await axios.all(promises)
                .then(axios.spread((...args) => {
                    for (let i = 0; i < args.length; i += 1) {
                        response[i] = args[i].data;
                    }
                }));
        } catch (error) {
            console.log(error);
            return;
        }

        return response;
    }

    // Gives the weather based on user's input (after Luis recognized the intent)
    async getWeather(context, luisResult) {
        const cities = luisResult.entities.map((entityObj) => entityObj.entity);

        if (luisResult.entities.length > 0) {
            const result = await this.getWeatherInfos(cities);
            for (const city of result) {
                const info = `👉 Current weather for ${ city.name }: ${ city.weather[0].description }.\n\n` +
                    `🌡️ Temperature in ${ city.name }: ${ city.main.temp }°C, feels like ${ city.main.feels_like }°C\n\n` +
                    `☁️ Humidity level: ${ city.main.humidity }%\n\n` +
                    `🌬️ Wind: ${ Math.round(city.wind.speed * 3.6) }km/h\n\n`;
                await context.sendActivity(info, info, InputHints.IgnoringInput);
            }
        }
    }
}

module.exports.CoreBot = CoreBot;
