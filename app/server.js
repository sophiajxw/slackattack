import botkit from 'botkit';
import Yelp from 'yelp';
import GoogleMapsAPI from 'googlemaps';
// this is es6 syntax for importing libraries

/* codes from starter package provided by Professor Tregubov*/
console.log('starting bot');

// setting up yelp
const yelp = new Yelp({
  consumer_key: 'Ol_N4Re7pAKYwn8g-0M-hQ',
  consumer_secret: 'rYug5rjPjsdN9sFGlCzJdaAI_BU',
  token: 'VnYK_NTB2zXykoYsMXJjGwxAEFCmzdJA',
  token_secret: '0ulDdJmuHbVM4M_3J3hwAisuGt0',
});

// setting up google map
/* code adapted from https://www.npmjs.com/package/googlemaps */
const publicConfig = {
  key: 'AIzaSyDHKYiZ65GRnXOgEfyKWnETJndFIHVwcdk',
  stagger_time: 1000, // for elevationPath
  encode_polylines: false,
  secure: true, // use https
  proxy: 'http://127.0.0.1:9999', // optional, set a proxy for HTTP requests
};
const gmAPI = new GoogleMapsAPI(publicConfig);

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({

  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM(err => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});


/* setting up messages*/

// hello responses
controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

/* Adapted from https://github.com/howdyai/botkit/blob/master/examples/convo_bot.js */
// messages for yelp
controller.hears(['hungry', 'restaurant', 'food'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  function askFlavor(response, convo) {
    convo.ask('Would you like food recomendations near you?', [
      {
        pattern: bot.utterances.yes,
        callback: () => {
          convo.say('Awesome.');
          askType(response, convo);
          convo.next();
        },
      },
      {
        pattern: bot.utterances.no,
        callback: () => {
          convo.say('...Don\'t fool me');
          convo.next();
        },
      },
      {
        default: true,
        callback: () => {
          convo.say('I don\'t understand what you\'re saying...');
          convo.repeat();
          convo.next();
        },
      },
    ]);
  }
  bot.startConversation(message, askFlavor);
});

const askType = function (response, convo) {
  convo.ask('What type of food are you interested in?', function (response, convo) {
    convo.say('Gotcha.');
    askLocation(response, convo);
    convo.next();
  });
};

const askLocation = function (type, convo) {
  convo.ask('Now tell me where you are?', function (response, convo) {
    convo.say('Okay. Give me one second. Pulling up results...');
    // searching yelp
    yelp.search({ term: `${type.text}`, location: `${response.text}`, limit: 3 })
      .then(function (data) {
        console.log(data);
        convo.say('Here are the top three matches. Enjoy.');
        data.businesses.forEach(business => {
          const attachments = {
            text: `rating: ${business.rating}`,
            attachments: [
              {
                fallback: 'uhoh',
                title: `${business.name}`,
                title_link: `${business.url}`,
                text: `${business.snippet_text}`,
                image_url: `${business.image_url}`,
                color: '#7CD197',
              },
            ],
          };
          convo.say(attachments);
        });
        convo.next();
      })
      .catch(function (err) {
        convo.say('Sorry I can\'t find the results.');
        console.error(err);
      });
    convo.next();
  });
};

// message for maps
/* code adapted from https://www.npmjs.com/package/googlemaps */
controller.hears(['lost', 'map', 'direction', 'how to get there'], ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  bot.reply(message, 'Seems like you\'re lost. I will pull up the map for you in one second.');
  const params = {
    center: '9 Maynard St, Hanover, NH',
    zoom: 15,
    size: '600x500',
    maptype: 'roadmap',
    markers: [
      {
        location: '9 Maynard St, Hanover, NH',
        label: 'A',
        color: 'green',
        shadow: true,
      },
      {
        location: 'Dirt Cowboy Cafe, Hanover, NH',
        icon: 'http://chart.apis.google.com/chart?chst=d_map_pin_icon&chld=cafe%7C996600',
      },
    ],
    style: [
      {
        feature: 'road',
        element: 'all',
        rules: {
          hue: '0x00ff00',
        },
      },
    ],
    path: [
      {
        color: '0x0000ff',
        weight: '5',
        points: [
          '43.707079, -72.287075',
          '43.702322, -72.289557',
        ],
      },
    ],
  };
  // bot.respond ( with url from gmAPI.)
  const attachments = {
    attachments: [
      {
        text: 'There\'s also a cafe around you. Go get a coffee! I\'ve pointed out the road for you.',
        color: '#7CD197',
        image_url: gmAPI.staticMap(params),
      },
    ],
  };
  // return result to user
  console.log(gmAPI.staticMap(params));
  bot.reply(message, attachments);
});

// outgoing webhook
controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'Here I am! What\'s up? http://giphy.com/gifs/friends-rachel-green-tv-VZXuygf0oUb5u');
});

// default reply for what bot can do
controller.hears(['help', 'what can you do'], ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  bot.reply(message, 'Here is what I can do: I can chat with you; send you nearby restaurant info; send you a google map, and a route to a nearby cafe.');
});

// default reply
controller.hears('(.*)', ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  bot.reply(message, 'What are you even talking about???');
});
