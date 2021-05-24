/*
    IMPORTS
*/
var datastore = require('./database');
var express = require('express')
var router = express.Router();
var helpers = require('./helpers');

/*
    ROUTES
*/

// CREATE A BOAT 

router.post('/', async (req, res) => {

    // Verify the incoming body has a name, type and length
    if (!req.body.name || !req.body.type || !req.body.length) {
        res.status(400).json({
            Error: "The request object is missing at least one of the required attributes"
        })
    }

    // If it does..
    else {

        // Construct the key and data for the datastore query
        var boatKey = datastore.key('Boat');
        var boat = {
            name: req.body.name,
            type: req.body.type,
            length: parseInt(req.body.length),
            loads: []
        }
        var entity = {
            key: boatKey,
            data: boat
        }

        // Insert the new boat
        await datastore.insert(entity);

        // Now get the boat back so we can display it
        const [boatResult] = await datastore.get(boatKey);

        // Add the id and self fields
        boatResult["id"] = boatResult[datastore.KEY].id.toString();
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + boatResult[datastore.KEY].id;
        boatResult["self"] = self;

        // Send the new boat back to the user
        res.status(201).json({
            id: boatResult.id,
            name: boatResult.name,
            type: boatResult.type,
            length: boatResult.length,
            loads: boatResult.loads,
            self: boatResult.self
        })
    }
})

// GET A BOAT

router.get('/:boat_id', async (req, res) => {
    let boat_id = req.params.boat_id;

    // See if the query included a boat ID
    if (!boat_id) 
    {
        res.status(404).json({
            Error: "No boat with this boat_id exists"
        })
    }

    // If it did...
    else 
    {
        // Create a datastore key from the boat ID and try to retrieve the key
        let boatKey = datastore.key(['Boat', datastore.int(boat_id)]);
        let [boatResult] = await datastore.get(boatKey)


        // If we get undefined back, the boat doesn't exist
        if (boatResult === undefined) {
            res.status(404).json({
                Error: "No boat with this boat_id exists"
            })
        }

        // Otherwise...
        else
        {

            // Add the id and self attributes to the object and send it back to the user
            boatResult["id"] = boatResult[datastore.KEY].id.toString()
            let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + boatResult[datastore.KEY].id;
            boatResult["self"] = self;
            
            
            // Get the actual load for each of the stored load keys
            boatResult["loads"] = await Promise.all(boatResult.loads.map(async (load) => {
                let [loadResult] = await datastore.get(load);
                let self = req.protocol + "://" + req.get("host") +  "/loads/" + loadResult[datastore.KEY].id;
                let thisLoad = {
                    id: loadResult[datastore.KEY].id,
                    self: self

                }
                return thisLoad
            }));
            
            // Format the data correctly.
            let newBoatResult = {
                id: boatResult.id,
                name: boatResult.name,
                type: boatResult.type,
                length: boatResult.length,
                loads: boatResult.loads,
                self: boatResult.self
            }

            // Send 200 back to user
            res.status(200).json(newBoatResult);
        }

    }
});

// GET ALL BOATS

router.get('/', async (req, res) => {
    let pageNumber = req.query.page;
    
    // Create and run a query to get all the boats
    let boatQuery = pageNumberHandler(pageNumber, 'Boat')
    const boatResults = await datastore.runQuery(boatQuery);
    
    // Hacky workaround to see if there are results on the next page
    // Google Cloud has a weird bug where 'moreResults' is always === MORE_RESULTS_AFTER_LIMIT
    // Bug Link: https://github.com/googleapis/google-cloud-datastore/issues/130
    let nextBoatQuery = pageNumberHandler(parseInt(pageNumber) + 1, 'Boat')
    const nextBoatResults = await datastore.runQuery(nextBoatQuery);

    // Add the next property if required (based on the next page actually having results)
    if (nextBoatResults[0].length) {
        if (pageNumber === undefined) {
            boatResults[0].push({
                "next": req.protocol + "://" + req.get("host") + req.baseUrl + "?page=2"
            })
        } else {
            boatResults[0].push({
                "next": req.protocol + "://" + req.get("host") + req.baseUrl + "?page=" + (parseInt(pageNumber) + 1)
            })
        }

    }

    // Add the 'id' and 'self' property to each of the boat objects.
    const [boats] = boatResults;

    let newBoats = await Promise.all(boats.map(async entity => {
        if (!(entity.hasOwnProperty("next"))) {
            let id = entity[datastore.KEY].id
            let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + entity[datastore.KEY].id;
            let loads = [];

            if (entity.loads.length !== 0) {
                loads = await Promise.all(entity.loads.map(async loadEntity => {
                    [loadResult] = await datastore.get(loadEntity);
                    return {
                        id: loadResult[datastore.KEY].id,
                        self: req.protocol + "://" + req.get("host") + "/loads/" + loadResult[datastore.KEY].id
                    }
                    
                }))
                
            }
            return {
                id,
                name: entity.name,
                type: entity.type,
                length: entity.length,
                loads,
                self
            }
        } else {
            return entity
        }
    }))
    
    // Return the result
    res.status(200).json(newBoats);
});

// PUT A LOAD IN A BOAT

router.put('/:boat_id/loads/:load_id', async (req, res) => {
    let boat_id = req.params.boat_id;
    let load_id = req.params.load_id;

    // Create the keys for the lookups in the database
    let boatKey = datastore.key(['Boat', datastore.int(boat_id)])
    let loadKey = datastore.key(['Load', datastore.int(load_id)])

    // Determine if the boat and load is valid
    let [boatResult] = await datastore.get(boatKey);
    let [loadResult] = await datastore.get(loadKey);

    if (boatResult === undefined && loadResult === undefined) {
        res.status(404).json({
            Error: "The specified boat and load does not exist"
        })
    } else if (boatResult === undefined) {
        res.status(404).json({
            Error: "The specified boat does not exist"
        })
    } else if (loadResult === undefined) {
        res.status(404).json({
            Error: "The specified load does not exist"
        })
    } else if (loadResult.carrier !== null) {

        if (loadResult.carrier.id === boatKey.id) {
            res.status(403).json({
                Error: "The specified load has already been assigned to this boat."
            })
        } else {
            res.status(403).json({
                Error: "The specified load has already been assigned to another boat."
            })
        }

    // If it is valid...
    } else {

        // Add the load to the boatResult
        boatResult.loads.push(loadKey)

        // Create a boat object and save the updated version to the database
        let boat = {
            name: boatResult.name,
            type: boatResult.type,
            length: boatResult.length,
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
            carrier: boatKey,
            content: loadResult.content,
            creation_date: loadResult.creation_date
        }
        let loadEntity = {
            key: loadKey,
            data: load
        }
        await datastore.update(loadEntity)

        // Send back a 204 confirming the update was made
        res.status(204).json()
    }
})

// REMOVE A LOAD FROM A BOAT

router.delete('/:boat_id/loads/:load_id', async (req, res) => {
    let boat_id = req.params.boat_id;
    let load_id = req.params.load_id;

    // Create the keys for the lookups in the database
    let boatKey = datastore.key(['Boat', datastore.int(boat_id)])
    let loadKey = datastore.key(['Load', datastore.int(load_id)])

    // Determine if the boat and load is valid
    let [boatResult] = await datastore.get(boatKey);
    let [loadResult] = await datastore.get(loadKey);
    
    
    if (boatResult === undefined && loadResult === undefined) {
        res.status(404).json({
            Error: "The specified boat and load does not exist"
        })
    } else if (boatResult === undefined) {
        res.status(404).json({
            Error: "The specified boat does not exist"
        })
    } else if (loadResult === undefined) {
        res.status(404).json({
            Error: "The specified load does not exist"
        })
    } else if (loadResult.carrier === null || !keysAreEqual(loadResult.carrier, boatKey)) {
        res.status(403).json({
            Error: "The specified load is not on this boat."
        })

    // If it is valid...
    } else {

        // Add the load to the boatResult
        boatResult.loads = boatResult.loads.filter(element => element.id !== loadKey.id)

        // Create a boat object and save the updated version to the database
        let boat = {
            name: boatResult.name,
            type: boatResult.type,
            length: boatResult.length,
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
        res.status(204).json()
    }
})

// DELETE A BOAT

router.delete('/:boat_id', async (req, res) => {
    let boat_id = req.params.boat_id;

    // Get the boat to see if there are any loads
    let boatKey = datastore.key(['Boat', datastore.int(boat_id)]);
    let [boatResult] = await datastore.get(boatKey);

    // See if the boat was valid
    if (boatResult === undefined) {
        res.status(404).json({
            Error: "No boat with this boat_id exists"
        })
    } else {
        // Check the boat for loads
        if (!boatResult.loads.length) {
            
            // If it doesn't have a load, delete the boat, and send a 204.
            datastore.delete([boatKey]);
            res.status(204).json();
        } else {

            // If it does have a load...

            // Update the loads to not have a carrier
            await boatResult.loads.forEach(async load => {
                var [current] = await datastore.get(load);

                var newLoad = {
                    volume: current.volume,
                    carrier: null,
                    content: current.content,
                    creation_date: current.creation_date       
                }
                let entity = {
                    key: load,
                    data: newLoad
                }

                await datastore.update(entity);
            })

            // Delete the boat
            await datastore.delete(boatKey);
            res.status(204).json();
        }
    }
})

// GET ALL LOADS FOR A BOAT

router.get('/:boat_id/loads', async (req, res) => {
    let boat_id = req.params.boat_id;

    // Get the boat first
    let boatKey = datastore.key(['Boat', datastore.int(boat_id)]);
    let [boatResult] = await datastore.get(boatKey);

    // Verify the boat exists
    if (boatResult === undefined) {
        res.status(404).json({
            Error: "The specified boat does not exist."
        })

    // If it does exist
    } else {
        let loads = boatResult.loads;

        // If there are no loads, skip the querying and send the result right away
        if (loads.length === 0) {
            res.status(200).json([])
        
        // If there are loads, query each one for details and send back all the loads
        } else {

            let detailedLoads = await Promise.all(loads.map(async load => {
                let [loadResult] = await datastore.get(load);
                
                // Add the id and self fields
                loadResult["id"] = loadResult[datastore.KEY].id;
                let self = req.protocol + "://" + req.get("host") + "/loads/" + loadResult[datastore.KEY].id;
                loadResult["self"] = self;

                // Send the new load back to the array created by map function.
                return {
                    id: loadResult.id,
                    volume: loadResult.volume,
                    content: loadResult.content,
                    creation_date: loadResult.creation_date,
                    self: loadResult.self
                }
            }));
            res.status(200).json(detailedLoads);
        }
    }
})

/*  
    EXPORTS
*/
module.exports = router;