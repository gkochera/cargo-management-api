/**
 * Author: George Kochera
 * Date: 5/10/2021
 * File: helper.js
 * Description: Contains helper functions and sections of code that are reusable.
 */

/*
    IMPORTS
*/

var datastore = require('./database');
let got = require('got');                       // Modern request library for crafting and sending requests. Used since 'request'
                                                // library is deprecated.
var jwt = require('jsonwebtoken');              // Used to verify the JWT
var jwksClient = require('jwks-rsa');


/*
    HELPER FUNCTIONS
*/


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
 * Takes two datastore.KEY objects and returns true if they are equal.
 */
function keysAreEqual(key1, key2){
    let id1 = key1.id;
    let id2 = key2.id;

    if (id1 === id2) {
        return true;
    } else {
        return false;
    }
}

/**
 * Returns a list of paginated results given a page number as an int and datastore kind as a string.
 * 
 * Returns an empty array if the page contains no items (page beyond the results)
 */
function pageNumberHandler(pageNumber, queryKind){
    if (pageNumber !== undefined && pageNumber > 1) {
        return datastore.createQuery(queryKind).offset(3 * (pageNumber - 1)).limit(3);
    } else {
        return datastore.createQuery(queryKind).limit(3);
    }
}

/**
 * Gets a boat from the database using the ID number. Returns undefined if the boat doesn't exist.
 */
async function getBoatFromID(boatID) {
    // Get the boat to see if there are any loads
    let boatKey = datastore.key(['Boat', datastore.int(boatID)]);
    let [boatResult] = await datastore.get(boatKey);
    return boatResult
}

/**
 * Creates a datastore.KEY object for a Boat with the given ID as int. id cannot be 0.
 */
function createBoatKey (id) {
    return datastore.key(['Boat', datastore.int(id)])
}

/**
 * Determines if there is a boat with the same name already in the database. Returns true if there is.
 */
async function existsBoatWithSameName(boatName, boat_id=undefined) {
    
    // Handle case when client update doesn't include a boat name
    if (boatName === undefined)
    {
        return false
    }

    // Create the query and run it to see if a Boat exists with that name
    let query = datastore.createQuery('Boat')
    .filter('name', '=', boatName.toString())

    let [result] = await datastore.runQuery(query, {wrapNumbers: true});

    // If there are no results, there is no boat with that name
    if (result.length < 1)
    {
        return false
    }
    
    // If the boat exists but has the id of the boat being updated, the user is
    // reassigning the same name to the same boat which isn't considered a change
    if (result[0][datastore.KEY].id.toString() === boat_id)
    {
        return false
    }

    // Otherwise the boat exists with that name already
    return true
}

/**
 * Determines if a string is 1-40 characters long, doesn't start with a space and has no special characters.
 * 
 * Returns true if it is valid.
 */
function stringIsValid(string) {
    let re = /^[0-9a-zA-Z][0-9a-zA-Z ]{0,39}$/
    return re.test(string);
}


/**
 * Determines if an integer is actually an integer and not text.
 * 
 * @returns true if the integer is valid.
 */
function integerIsValid (integer) {
    if (isNaN(parseInt(integer, 10)))
    {
        return false
    }

    return true
}

/**
 * Examines the incoming request body to ensure submitted data is valid. Returns false if any of the three
 * allowed attributes are not valid.
 */
function requestIsValid(req, res) {

    if (req.body.name !== undefined)
    {
        if (!stringIsValid(req.body.name))
        {
            res.status(400).json({
                Error: "The boat name is invalid. Names must be 1-40 alphanumeric characters long, contain no special symbols except spaces."
            })
            return false;
        }
    }

    if (req.body.length !== undefined)
    {
        if (!integerIsValid(req.body.length))
        {
            res.status(400).json({
                Error: "The boat length is invalid. Lengths must be an integer."
            })
            return false;
        }
    }

    if (req.body.type !== undefined)
    {
        if (!stringIsValid(req.body.type))
        {
            res.status(400).json({
                Error: "The boat type is invalid. Names must be 1-40 alphanumeric characters long, contain no special symbols except spaces."
            })
            return false;
        }
    }

    return true
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

module.exports = {
    keysAreEqual,
    pageNumberHandler,
    getBoatFromID,  
    createBoatKey,
    existsBoatWithSameName,
    requestIsValid,
    getGoogleInformation,
    validateJWT
}