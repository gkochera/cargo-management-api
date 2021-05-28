/**
 * Author: George Kochera
 * Date: 4/30/21
 * File: boats.js
 * Description: Contains all the /boats route handlers.
 */

/*
    IMPORTS
*/
var { Boat, Load } = require('./classes');
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
        let user = await h.getUserFromID(req.sub);
        if (user === undefined)
        {
            let error = {Error: "You must be a registered user in order to create a new boat."}
            res.status(403).json(error);
            return
        }

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
        res.status(201).json(await newBoat.getBoat(req))
        return
    }

    // If the user is not authenticated and does not have a valid JWT
    res.status(401).json({Error: "You must be authenticated to perform this action."})

})

// GET A SPECIFIC BOAT

router.get('/:boat_id', m.clientMustAcceptJSON, async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.boat_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The boat_id you specified is not valid."
        })
    }

    // If the JWT is valid...
    if (req.authenticated)
    {
        let boat_id = req.params.boat_id;

        // See if the query included a boat ID
        if (!boat_id) 
        {
            return res.status(404).json({
                Error: "No boat with this boat_id exists"
            })
        }

        // If it did...
        else 
        {
            // Create a datastore key from the boat ID and try to retrieve the key
            let boatResult = await h.getBoatFromID(boat_id);
            console.log(boatResult);
            // If we get undefined back, the boat doesn't exist
            if (boatResult === undefined) {
                return res.status(404).json({
                    Error: "No boat with this boat_id exists"
                })
            }

            // Otherwise...
            else
            {
                let boat = new Boat(boatResult, req);

                if (req.sub === boat.owner)
                {
                    // Send 200 back to user
                    return res.status(200).json(await boat.getBoat(req));
                }
                else
                {
                    // Send 403 back to user
                    return res.status(403).json({
                        Error: "Boats are protected entities that are only viewable by the owner. Verify you are using the correct JWT."
                    })
                }

            }
        }
    }
    // If the user is not authenticated and does not have a valid JWT
    return res.status(401).json({Error: "You must be authenticated to perform this action."})
});

/**
 * GET ALL BOATS
 */
router.get('/', m.clientMustAcceptJSON, async (req, res) => {

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
                return newBoat.getBoat(req);
            }
            return boat;
    
        })
        boats = await Promise.all(boats).then((retrievedBoats) => {
            return retrievedBoats;
        })

        let totalBoats = await h.getNumberBoats();
        let totalUserBoats = await h.getNumberOfUserBoats(req.sub);

        boats.push({
            totalUserBoats,
            totalBoats
        })

        return res.status(200).json(boats);
    }

    // If the user is not authenticated and does not have a valid JWT
    return res.status(401).json({Error: "You must be authenticated to perform this action."})
})


/**
 * DELETE A BOAT
 */
router.delete('/:boat_id', async (req, res) => {
    
    // Test for garbage URL parameters
    let screenedVariable = req.params.boat_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The boat_id you specified is not valid."
        })
    }

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

        // Remove all loads from the boat
        let boat = new Boat(boatResult, req)
        boat.removeAllLoads();

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

// PUT A LOAD IN A BOAT

router.put('/:boat_id/loads/:load_id', async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable1 = req.params.boat_id;
    if (screenedVariable1 === undefined || isNaN(parseInt(screenedVariable1)))
    {
        return res.status(400).json({
            Error: "The boat_id you specified is not valid."
        })
    }

    // Test for garbage URL parameters
    let screenedVariable2 = req.params.load_id;
    if (screenedVariable2 === undefined || isNaN(parseInt(screenedVariable2)))
    {
        return res.status(400).json({
            Error: "The load_id you specified is not valid."
        })
    }

    if (req.authenticated)
    {
        let boat_id = req.params.boat_id;
        let load_id = req.params.load_id;
    
        // Create the keys for the lookups in the database
        let boatKey = datastore.key(['Boat', datastore.int(boat_id)])
        let loadKey = datastore.key(['Load', datastore.int(load_id)])
    
        // Determine if the boat and load is valid
        let [boatResult] = await datastore.get(boatKey);
        let [loadResult] = await datastore.get(loadKey);
    
        if (boatResult === undefined && loadResult === undefined) {
            return res.status(404).json({
                Error: "The specified boat and load does not exist"
            })
        } else if (boatResult === undefined) {
            return res.status(404).json({
                Error: "The specified boat does not exist"
            })
        } else if (loadResult === undefined) {
            return res.status(404).json({
                Error: "The specified load does not exist"
            })
        } else if (loadResult.carrier !== null) {
    
            if (loadResult.carrier.id === boatKey.id) {
                return res.status(403).json({
                    Error: "The specified load has already been assigned to this boat."
                })
            } else {
                return res.status(403).json({
                    Error: "The specified load has already been assigned to another boat."
                })
            }
    
        // If it is valid...
        } else {

            // See if this boat is not owned by the logged in user
            if (boatResult.owner !== req.sub)
            {
                return res.status(403).json({
                    Error: "You cannot add a load to someone else's boat."
                })
            }
            
            let boat = new Boat(boatResult, req);
            let load = new Load(loadResult, req);

            // Add the load to the boatResult
            boat.loads.push(loadKey)
    
            // Create a boat object and save the updated version to the database
            await boat.update();
    
            // Create the load object and save it to the database
            load.carrier = boatKey;

            await load.update();
    
            // Send back a 204 confirming the update was made
            return res.status(204).json()
        }
    }

    // If the user is not authenticated and does not have a valid JWT
    return res.status(401).json({Error: "You must be authenticated to perform this action."})
})

// REMOVE A LOAD FROM A BOAT

router.delete('/:boat_id/loads/:load_id', async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable1 = req.params.boat_id;
    if (screenedVariable1 === undefined || isNaN(parseInt(screenedVariable1)))
    {
        return res.status(400).json({
            Error: "The boat_id you specified is not valid."
        })
    }

    // Test for garbage URL parameters
    let screenedVariable2 = req.params.load_id;
    if (screenedVariable2 === undefined || isNaN(parseInt(screenedVariable2)))
    {
        return res.status(400).json({
            Error: "The load_id you specified is not valid."
        })
    }

    if (req.authenticated)
    {
        let boat_id = req.params.boat_id;
        let load_id = req.params.load_id;
    
        // Create the keys for the lookups in the database
        let boatKey = datastore.key(['Boat', datastore.int(boat_id)])
        let loadKey = datastore.key(['Load', datastore.int(load_id)])
    
        // Determine if the boat and load is valid
        let [boatResult] = await datastore.get(boatKey);
        let [loadResult] = await datastore.get(loadKey);
        
        console.log(loadResult.carrier)
        console.log(boatKey)
        if (boatResult === undefined && loadResult === undefined) {
            return res.status(404).json({
                Error: "The specified boat and load does not exist"
            })
        } else if (boatResult === undefined) {
            return res.status(404).json({
                Error: "The specified boat does not exist"
            })
        } else if (loadResult === undefined) {
            return res.status(404).json({
                Error: "The specified load does not exist"
            })
        } else if (loadResult.carrier === null || !h.keysAreEqual(loadResult.carrier, boatKey)) {
            return res.status(403).json({
                Error: "The specified load is not on this boat."
            })
    
        // If it is valid...
        } else {

            // See if this boat is not owned by the logged in user
            if (boatResult.owner !== req.sub)
            {
                res.status(403).json({
                    Error: "You cannot remove a load from someone else's boat."
                })
                return
            }
    
            // Add the load to the boatResult
            boatResult.loads = boatResult.loads.filter(element => element.id !== loadKey.id)
    
            // Create a boat object and save the updated version to the database
            let boat = {
                name: boatResult.name,
                type: boatResult.type,
                length: boatResult.length,
                owner: boatResult.owner,
                loads: boatResult.loads
            }
    
            let boatEntity = {
                key: boatKey,
                data: boat
            }
            await datastore.update(boatEntity);
    
            // Create the load object and save it to the database
    
            let load = {
                volume: loadResult.volume,
                carrier: null,
                content: loadResult.content,
                creation_date: loadResult.creation_date
            }
            let loadEntity = {
                key: loadKey,
                data: load
            }
            await datastore.update(loadEntity)
    
            // Send back a 204 confirming the update was made
            return res.status(204).json()
        }
    }

    // If the user is not authenticated and does not have a valid JWT
    return res.status(401).json({Error: "You must be authenticated to perform this action."})
})

/**
 * UPDATE A BOAT (PARTIAL)
 */
 router.patch('/:boat_id', validate, async (req,res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.boat_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The boat_id you specified is not valid."
        })
    }

    if (req.authenticated)
    {
        // Validate the incoming body.
        if (!h.requestIsValid(req, res))
        {
            return
        }

        // Get boat id from URL
        let boat_id = req.params.boat_id;
        
        // Get the boat from DB, generate boat key
        let boatResult = await h.getBoatFromID(boat_id);
        let boat = new Boat(boatResult, req);
        
        // Return error if the boat doesn't exist
        if (boatResult === undefined)
        {   
            let error = {Error: "A boat with this boat_id was not found."};
            res.status(404).json(error);
        }

        // See if another boat already has this name
        if (await h.existsBoatWithSameName(req.body.name, boat_id))
        {
            let error = {Error: "There is already a boat with this name."}
            res.status(403).json(error);
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

        // Create a new boat object, update the boat object with desired data, update in DB
        let body;
        let status;
        if (!boat.updateFields(req)) 
        {
            body = {Error: "No properties of the boat were included in the body of the request."}
            status = 400
        }
        else
        {
            await boat.update();
            await boat.get(req);
            body = await boat.getBoat(req);
            status = 200;
        }
        return res.status(status).json(body);

    }
    // If the user is not authenticated and does not have a valid JWT
    return res.status(401).json({Error: "You must be authenticated to perform this action."})
})

/**
 * PARTIALLY UPDATE ALL BOATS (405 SENT)
 */
router.patch('/', (req,res) => {
    let code = 405
    let error = {Error: "You cannot update all boats."}
    res.setHeader('Allow', 'GET, POST')
    return res.status(code).json(error)
})

/**
 * COMPLETELY UPDATE A BOAT
 */
router.put('/:boat_id', validate, async (req,res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.boat_id
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The boat_id you specified is not valid."
        })
    }

    if (req.authenticated)
    {
        // Validate the incoming body.
        if (!h.requestIsValid(req, res))
        {
            return
        }

        // Get boat id from URL
        let boat_id = req.params.boat_id;
        
        // Get the boat from DB, generate boat key
        let boatResult = await h.getBoatFromID(boat_id);

        
        // Return error if the boat doesn't exist
        if (boatResult === undefined)
        {   
            let error = {Error: "A boat with this boat_id was not found."};
            return res.status(404).json(error);
        }

        // See if another boat already has this name
        if (await h.existsBoatWithSameName(req.body.name, boat_id))
        {
            let error = {Error: "There is already a boat with this name."}
            return res.status(403).json(error);
        }

        // See if this boat is not owned by the logged in user
        if (boatResult.owner !== req.sub)
        {
            return res.status(403).json({
                Error: "This boat_id exists but you are not the owner."
            })
        }

        let boat = new Boat(boatResult, req);

        // Create a new boat object, update the boat object with desired data, update in DB
        if (boat.updateAllFields(req)) 
        {
            await boat.update();
            await boat.get(req);
            res.setHeader('Location', boat.self);
            return res.status(303).json()
        }
        else
        {   
            let error = {Error: "PUTs at this endpoint require that all fields are updated. Use PATCH for partial updates."}
            return res.status(400).json(error)
        }
    }
    // If the user is not authenticated and does not have a valid JWT
    return res.status(401).json({Error: "You must be authenticated to perform this action."})
});

/**
 * COMPLETELY UPDATE ALL BOATS (405 SENT)
 */
router.put('/', (req,res) => {
    let code = 405
    let error = {Error: "You cannot update all boats."}
    res.setHeader('Allow', 'GET, POST')
    res.status(code).json(error)
})


/*  
    EXPORTS
*/
module.exports = router;