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


/**
 *  HELPER MIDDLEWARE
 */


/**
 * Enforces that the client must accept a Content-Type of 'application/json' by examining the HTTP request header.
 */
 var clientMustAcceptJSON = (req, res, next) => {

    if (req.accepts('json'))
    {
        next()
    }
    else
    {
        let code = 406;
        let error = {Error: "This endpoint only supports a Content-Type of application/json, please check your HTTP Accept headers."};
        res.status(code).json(error);
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

    const validKeys = ['name', 'type', 'length', 'public']
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

/*
    HELPER FUNCTIONS
*/

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

module.exports = {
    keysAreEqual,
    pageNumberHandler,
    getBoatFromID,  
    createBoatKey,
    existsBoatWithSameName,
    requestIsValid,
    bodyKeysToLower,
    bodyMustNotContainExtraAttributes,
    clientMustAcceptJSON
}