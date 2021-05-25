/**
 * Author: George Kochera
 * Date: 5/10/2021
 * File: app.js
 * Description: Contains the imports, middleware, some helper functions, route imports, and 
 * listeners for the main application for Project 7.
 */

/**
 *  IMPORTS
 */
var express = require('express');               // Web Server Gateway Interface
let ejs = require('ejs');                       // Templating Engine


var crypto = require("crypto");                 // Used to generate 'state'
var cookieParser = require('cookie-parser')     // Use to handle cookies.
var h = require('./helper');
var m = require('./middleware');
var boats = require('./boats');
var loads = require('./loads');
var users = require('./users');


/**
 *  MIDDLEWARE
 */

/**
 * Middleware that checks all incoming requests for proper JSON and a 'Content-Type' of 'application/json'.
 */
let clientSentJSON = (err, req, res, next) => {
    if (err instanceof SyntaxError && err.type === 'entity.parse.failed' && req.header('Content-Type') === 'application/json')
    {   
        res.status(400).json({Error: "A Content-Type of application/json was specified in the header but there was a Syntax Error in the body of the request."})
        return
    }
    if (req.header('Content-Type') !== 'application/json' && req.header('Content-Length') !== 0)
    {
        let error = {Error: `Content-Type of ${req.header('Content-Type')} is not supported by this endpoint.`}
        res.status(415).json({error})
        return
    }
    next()
}



/**
 * HELPERS
 */

/**
 * Returns a 32 bit random hex string. Good for state. 
 */ 
 function generateState() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 *  CONFIGURATION
 */

var app = express()
app.use(express.static('static'))
app.enable('trust proxy');
app.set('view engine', 'ejs')
app.use(express.json())
app.use(clientSentJSON);
app.use(cookieParser());
app.use(m.verifyJWT)

/**
 *  ROUTES
 */
app.use('/boats', boats);
app.use('/loads', loads);
app.use('/users', users);

app.get('/', (req, res) => {
    let state = {
        sent: generateState(),
        received: null
    }

    if (req.query.e == 1) {
        res.cookie('state', state).render('pages/index', {message: "alreadyRegistered"})
        return
    }

    if (req.query.e == 2) {
        res.cookie('state', state).render('pages/index', {message: "notRegistered"})
        return
    } 

    res.cookie('state', state).render('pages/index', {message: null})
    return
})

/**
 *  LISTENER
 */
app.listen(process.env.PORT || 8080, () => {
    console.log("CS493 Final Project is running!");
})