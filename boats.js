/**
 * Author: George Kochera
 * Date: 4/30/21
 * File: boats.js
 * Description: Contains all the /boats route handlers.
 */

/*
    IMPORTS
*/
var Boat = require('./boat_class')
var datastore = require('./database');
var express = require('express')
var router = express.Router();
var h = require('./helper');
var m = require('./middleware');

/**
 * Simplifies chaining the middleware declared above.
 */
var validate = [m.clientMustAcceptJSON, m.bodyKeysToLower, m.bodyMustNotContainExtraAttributes]

/*
    ROUTES
*/

/**
 * CREATE A BOAT
 */
router.post('/', validate, async (req, res) => {

    // If the user is authenticated and has a valid JWT...
    if (req.authenticated)
    {
        // Validate the incoming body.
        if (!h.requestIsValid(req, res))
        {
            return
        }

        // Create new boat object from input data
        const newBoat = new Boat(req);

        // Verify the incoming body has a name, type and length
        if (!newBoat.hasAllFields) {
            res.status(400).json({
                Error: "The request object is missing at least one of the required attributes"
            })
            return
        }

        // See if another boat already has this name
        if (await h.existsBoatWithSameName(newBoat.name))
        {
            let error = {Error: "There is already a boat with this name."}
            res.status(403).json(error);
            return
        }

        // Insert the boat
        await newBoat.insert()

        // Get the boat back
        await newBoat.get(req);

        // Send the new boat back to the user
        res.status(201).json(newBoat.getBoat())
        return
    }

    // If the user is not authenticated and does not have a valid JWT
    res.status(401).json({Error: "You must be authenticated to perform this action."})

})

/**
 * GET ALL BOATS
 */
router.get('/', async (req, res) => {

    // If the JWT is valid...
    if (req.authenticated)
    {
        let query = datastore.createQuery('Boat')
            .filter('owner', '=', req.sub);
        
        let [result] = await h.paginate(req, query);

        let boats = result.map(boat => {
            if (!boat.hasOwnProperty('next'))
            {
                let newBoat = new Boat(boat, req);
                return newBoat.getBoat();
            }
            return boat;
    
        })
        res.status(200).json(boats)
        return;
    }

    // If the JWT is not valid or missing..
    let query = datastore.createQuery('Boat')
        .filter('isPublic', '=', true);
    let [result] = await datastore.runQuery(query);
    let boats = result.map(boat => {
        if (!boat.hasOwnProperty('next'))
        {
            let newBoat = new Boat(boat, req);
            return newBoat.getBoat();
        }
        return boat;

    })
    res.status(200).json(boats)
    return
})


/**
 * DELETE A BOAT
 */
router.delete('/:boat_id', m.clientMustAcceptJSON, async (req, res) => {
    

    if (req.authenticated)
    {
        // Get boat id from URL
        let boat_id = req.params.boat_id;

        // Get the boat from DB, generate boat key
        let boatResult = await h.getBoatFromID(boat_id);
        let boatKey = h.createBoatKey(boat_id);

        // See if the boat was valid
        if (boatResult === undefined) 
        {
            res.status(403).json({
                Error: "No boat with this boat_id exists"
            })
            return
        }

        // See if this boat is not owned by the logged in user
        if (boatResult.owner !== req.sub)
        {
            res.status(403).json({
                Error: "This boat_id exists but you are not the owner."
            })
            return
        }

        // Delete the boat
        await datastore.delete(boatKey);
        res.status(204).json();
        return
    }
    res.status(401).json({
        Error: "You must be authenticated to perform this action."
    })
    return
})


/*  
    EXPORTS
*/
module.exports = router;