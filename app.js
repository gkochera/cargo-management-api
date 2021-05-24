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
let querystring = require('querystring');       // Parses query strings so we don't have to do a ton of string manipulation
let got = require('got');                       // Modern request library for crafting and sending requests. Used since 'request'
                                                // library is deprecated.
var jwt = require('jsonwebtoken');              // Used to verify the JWT
var crypto = require("crypto");                 // Used to generate 'state'
var cookieParser = require('cookie-parser')     // Use to handle cookies.
var boats = require('./boats');
var loads = require('./loads');
var users = require('./users');
var jwksClient = require('jwks-rsa')

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
 *  VERIFIES A WEB TOKEN FROM GOOGLE
 */
async function verifyJWT(req, res, next) {

    // Get the Authorization header
    let bearerHeader = req.get('Authorization')
    if (bearerHeader !== undefined) 
    {
        // Split the Bearer from the token and test that it actually is a Bearer token.
        var parts = bearerHeader.split(' ');
        var token;
        if (parts.length === 2) {
            var scheme = parts[0];
            var credentials = parts[1];

            if (/^Bearer$/i.test(scheme)) {
            token = credentials;
            }
        }
        
        // We call validateJWT to check the token against the Google Public Key, since its
        // asynchronous, we must wait for it. Req.authenticated will either be true or false.
        let tokenValidation = await validateJWT(token)
        req.authenticated = tokenValidation.result
        req.sub = tokenValidation.sub
        return next();

    }
    
    // If there is no bearer token, we know this is not an authenticated request.
    req.authenticated = false;
    return next();

}

/**
 * Step 1 - Gets the authrorization code - OAuth 2.0
 * 
 * Determines if the query string includes a 'code' value. If not, then the
 * first request to this middleware gets redirected to google to go through
 * authentication. The redirect from google will call this a second time but
 * will include a 'code' value in the query string. We use the state in the
 * cookie sent to the visitor in the / main route.
 * 
 * The second time, the received state in the query string is compared with
 * the state we sent to see if they are the same (anti-forgery). If they, are
 * different, we send the user an error indicating the difference in states.
 * 
 * If they are the same, we allow the user to continue and consider them
 * authenticated.
 */
 function authenticate(req, res, next) {

    // See if there is a code and scope in the query string
    let code = req.query.code
    let scope = req.query.scope

    // If there is no code, we haven't authenticated, so we redirect the user to Google.
    if (code === undefined) {

        // The state we are sending
        console.log(req.cookies)
        let sentState = req.cookies.state.sent

        // Endpoint for Google OAuth 2.0
        let url = "https://accounts.google.com/o/oauth2/v2/auth?"

        // The parameters required by the Google OAuth 2.0 endpoint.
        let params = {
            client_id: "157212195746-bd9c1dckf9db2uojj5tltohqquc3hq9d.apps.googleusercontent.com",
            redirect_uri: getFullURL(req) + "/oauth",
            response_type: "code",
            scope: "https://www.googleapis.com/auth/userinfo.profile",
            access_type: "online",
            state: sentState
        }
        
        // Add the query string to the endpoint URI.
        url = url + querystring.stringify(params)

        // Redirect and return. Google will redirect to an endpoint that requires this middleware
        // at which point 'code' will be set and the request allowed to proceed.
        res.redirect(url)
        return
    }

    // If we get this far, we are getting the redirect back from Google, we now need to verify the 
    // state.

    // Add the received state to the cookie
    req.cookies.state.received = req.query.state

    // Compare the sent and received state. Send the user to an error page if they don't match.
    if (req.cookies.state.received !== req.cookies.state.sent) {

        res.render('pages/error', {state: req.cookies.state, error: "stateMismatch"});
        return
    }

    // If they match, add the code and scope to the cookie so we can display it on the users screen.
    req.cookies.state.code = code;
    req.cookies.state.scope = scope;
    next()
}


/**
 * Step 2 - Gets the access token.
 * 
 * If this middleware executes, we can then assume we have a code (valid or otherwise).
 * 
 * This request is made and then the user is allowed to proceed
 * with the access token held in res.locals.google.access_token.
 */
async function getToken (req, res, next) {

    // Form the access_token request query.
    let params = {
        client_id: "157212195746-bd9c1dckf9db2uojj5tltohqquc3hq9d.apps.googleusercontent.com",
        client_secret: "-QArd1VuBEgL_xDQwU6Pz36l",
        code: req.cookies.state.code,
        grant_type: "authorization_code",
        redirect_uri: getFullURL(req) + "/oauth"
    }

    // It's a POST request
    let options = {
        method: 'POST'
    }

    // This is the Google endpoint we get the token from.
    let url = "https://oauth2.googleapis.com/token?" + querystring.stringify(params)

    // Throw this in a try block to catch attempted refreshes.
    try {

        // Get the response back from Google.
        let response = await got(url, options)

        // Save the response in res.locals (lifetime is only the duration of the response
        // so it is not persistent, that is we aren't saving it to the server where it 
        // could be confused with other responses.)
        res.locals.google = JSON.parse(response.body)

    // Catch got.HTTPError which is thrown when client tries to refresh.
    } catch (e) {
        if (e instanceof got.HTTPError) {
            res.render('pages/error', {state: req.cookies.state, error: "attemptedRefresh"});
            return   
        }
    }

    // Let them continue...
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
 * Gets the Google Public RSA Keys
 * Source: From the 'jsonwebtoken' repo on GitHub
 */

function getKey(header, callback){
    var client = jwksClient({
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs'
    })

    client.getSigningKey(header.kid, function(err, key) {
        var signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

/**
 * Verifies a JWT's validity
 */
function validateJWT(token) {

    // Since this is an async event, we create a promise that is fulfilled based
    // on if the token was valid or not.
    var promise = new Promise((resolve, reject) => {

        // Verify the token is valid, or not. Then reject or resolve the Promise
        // based on the outcome.
        jwt.verify(token, getKey, (err, decode) => {
            if (err)
            {
                console.log('FAIL', err)
                reject({result: false, sub: null});
            }
            else
            {
                console.log('PASS', decode)
                resolve({result: true, sub: decode.sub});
            }
        })  
    })

    // Return the promise which we will await on for the result.
    return promise.then((result) => {return result}, (result) => {return result})
}

/**
 * Returns the string of the host URI including the protocol.
 */
function getFullURL(req) {
    let host = req.get('host')
    let protocol = req.protocol
    return protocol + "://" + host
}

/**
 * ASYNC
 * Makes a request to the Google People API to retrieved the 
 * current logged in user's 'names' data.
 */
async function getGoogleInformation(res) {
    let options = {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + res.locals.google.access_token
        }
    }
    let response = await got("https://people.googleapis.com/v1/people/me?personFields=names", options)
    return response
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
app.use(verifyJWT)

/**
 *  ROUTES
 */
app.use('/boats', boats);
app.use('/users', users);

app.get('/', (req, res) => {
    let state = {
        sent: generateState(),
        received: null
    }
    res.cookie('state', state).render('pages/index')
})

/**
 * OAuth endpoint
 * 
 * Clients access this endpoint and are initially redirected to Google
 * for authentication (unless they knew to set the code query string).
 * 
 * The redirect from google will also access this endpoint but with the
 * code query string set. In addition, this endpoint expects that the client
 * has a cookie 'state' with the 'sent' field set. This happens when the
 * client visits the root route first.
 * 
 * If the 2nd redirect (back from Google) contains a valid code, the getToken
 * middleware gets the access_token for a People API request. 
 * 
 * The People API request is made in this function, and the data object is
 * populated and ultimately rendered on the screen for the user to view.
 */
 app.get('/oauth', authenticate, getToken, async (req, res) => {
    // Because we use the 'authenticate' middleware
    // we can guarantee we will have a code, and because
    // we use the 'getToken' middleware, we can guarantee we have
    // a request token. At this point, we just need the data.
    let googleResponse = await getGoogleInformation(res)
    let body = JSON.parse(googleResponse.body)
    let data = {
        firstName: body.names[0].givenName,
        lastName: body.names[0].familyName,
        state: req.cookies.state,
        id_token: res.locals.google.id_token
    }
    res.render('pages/userinfo', {data: data})
})

/**
 *  LISTENER
 */
app.listen(process.env.PORT || 8080, () => {
    console.log("CS493 Final Project is running!");
})