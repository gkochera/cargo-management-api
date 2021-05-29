let querystring = require('querystring');       // Parses query strings so we don't have to do a ton of string manipulation
let got = require('got');                       // Modern request library for crafting and sending requests. Used since 'request'
                                                // library is deprecated.
let h = require('./helper');
const datastore = require('./database');
/**
 *  HELPER MIDDLEWARE
 */


/**
 * Enforces that the client must accept a Content-Type of 'application/json' by examining the HTTP request header.
 */
 var clientMustAcceptJSON = (req, res, next) => {

    if (req.get('Accept') === undefined || !req.accepts('json'))
    {
        let code = 406;
        let error = {Error: "This endpoint only supports a Content-Type of application/json, please check your HTTP Accept headers."};
        return res.status(code).json(error);
    }
    else
    {
        next()
    }
}

/**
 * Enforces that the received JSON must not contain properties other than the ones in validKeys.
 * 
 * Valid Keys are name, type and length.
 * 
 * Example: User attempts to modify id in a request, an HTTP 400 will be returned.
 */
var bodyMustNotContainExtraAttributes = (req, res, next) => {

    const validKeys = ['name', 'type', 'length']
    const bodyKeys = Object.keys(req.body);
    let badKey = false;
    bodyKeys.map(key => {

        if (!validKeys.includes(key)) {
            let code = 400;
            let error = {Error: `${key} is not a valid property for this endpoint. Check your request body for extra attributes.`}
            badKey = true;
            res.status(code).json(error)
        }
    })

    if (!badKey)
    {
        next()
    }
}

/**
 * Converts a JS object with any UPPERCASE keys to lowercase.
 */
var bodyKeysToLower = (req, res, next) => {
    const body = req.body

    let keys = Object.keys(body);

    let newBody = {};

    keys.map(key => {
        newBody[key.toLowerCase()] = body[key];
    })
    
    req.body = newBody;
    
    next()
}



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
            client_id: "937934225644-mrmug3ed0lum6ppivqvvs4fj40b3s0q8.apps.googleusercontent.com",
            redirect_uri: getFullURL(req) + req.originalUrl,
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
        client_id: "937934225644-mrmug3ed0lum6ppivqvvs4fj40b3s0q8.apps.googleusercontent.com",
        client_secret: "IM_IW9sEWBqeWV9DwAKmj1sT",
        code: req.cookies.state.code,
        grant_type: "authorization_code",
        redirect_uri: getFullURL(req) + req.originalUrl.split("?", 1)
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
            console.log(e);
            res.render('pages/error', {state: req.cookies.state, error: "attemptedRefresh"});
            return   
        }
    }

    // Let them continue...
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
        let tokenValidation = await h.validateJWT(token).catch(e => {
            console.log(e);
            return res.status(400).json({
                Error: "The JWT you submitted was invalid."
            })
        })
        req.authenticated = tokenValidation.result
        req.sub = tokenValidation.sub

        // See if the JWT belongs to a registered user
        let userQuery = datastore.createQuery('User').filter('sub', '=', req.sub);
        let [userResults] = await datastore.runQuery(userQuery);
        if (userResults.length > 0)
        {
            req.isRegistered = true;
        }
        else
        {
            req.isRegistered = false;
        }

        return next();

    }
    
    // If there is no bearer token, we know this is not an authenticated request.
    req.authenticated = false;
    req.isRegistered = false;
    return next();
}

/**
 * Checks to see if a person is registered
 */

function isRegistered(req, res, next) {
    if (req.isRegistered)
    {
        return next();
    }

    res.status(403).json({
        Error: "You must register before using this endpoint."
    })
    return;
}

/**
 * Returns the string of the host URI including the protocol.
 */
function getFullURL(req) {
    let host = req.get('host')
    let protocol = req.protocol
    return protocol + "://" + host
}



module.exports = {
    authenticate,
    getToken,
    bodyKeysToLower,
    bodyMustNotContainExtraAttributes,
    clientMustAcceptJSON,
    verifyJWT,
    isRegistered
}