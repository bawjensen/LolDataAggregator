var querystring = require('querystring');

var apiKey = process.env.RIOT_KEY;

module.exports = {
    URL_PREFIX: 'https://',
    BASE_URL: '.api.pvp.net/api/lol/',
    API_KEY: apiKey,

    REGIONS: [
        'na',
        'euw',
        'eune',
        'lan',
        'las',
        'br',
        'tr',
        'ru',
        'oce',
        'kr'
    ],

    CHALLENGER_ROUTE: '/v2.5/league/challenger',
    MATCH_HISTORY_ROUTE: '/v2.2/matchhistory/',
    MATCH_ROUTE: '/v2.2/match/',

    KEY_RANKED_TYPE_QUERY: querystring.stringify({ api_key: apiKey, type: 'RANKED_SOLO_5x5' }),
    KEY_RANKED_QUEUE_QUERY: querystring.stringify({ api_key: apiKey, rankedQueues: 'RANKED_SOLO_5x5' }),
    KEY_TIMELINE_QUERY: querystring.stringify({ api_key: apiKey, includeTimeline: true }),

    NUM_PER_CHAMP_ROLE: 10,
    UNKNOWN_ROLE: 'UNKNOWN'
}