/*
    IMPORTS
*/
var datastore = require('./database');
var express = require('express')
var router = express.Router();
var h = require('./helper');
var m = require('./middleware');
var { Boat, Load } = require('./classes');


/*
    ROUTES
*/

// CREATE A LOAD 

router.post('/', m.clientMustAcceptJSON, async (req, res) => {

    // Verify the incoming body has a volume, content and creation_date
    if (!req.body.volume || !req.body.content || !req.body.creation_date) {
        res.status(400).json({
            Error: "The request object is missing at least one of the required attributes"
        })
    }

    // If it does..
    else {

        // Construct the key and data for the datastore query
        var newLoad = new Load(req)

        // Insert the new load      
        await newLoad.insert();

        // Now get the load back so we can display it
        await newLoad.get(req);

        // Send the new load back to the user
        res.status(201).json(await newLoad.getLoad(req));
    }
})



// GET A LOAD

router.get('/:load_id', m.clientMustAcceptJSON, async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.load_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The load_id you specified is not valid."
        })
    }

    let load_id = req.params.load_id;
    
    // See if the query included a load ID
    if (!load_id) 
    {
        res.status(404).json({
            Error: "No load with this load_id exists"
        })
    }

    // If it did...
    else 
    {
        // Create a datastore key from the load ID and try to retrieve the key
        let loadKey = datastore.key(['Load', parseInt(load_id)]);
        let [loadResult] = await datastore.get(loadKey)

        // If we get undefined back, the load doesn't exist
        if (loadResult === undefined) {
            res.status(404).json({
                Error: "No load with this load_id exists"
            })
        }

        // Otherwise...
        else
        {

            // Add the id and self attributes to the object and send it back to the user
            loadResult["id"] = loadResult[datastore.KEY].id
            let loadSelf = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + loadResult[datastore.KEY].id;
            loadResult["self"] = loadSelf;

            // Parse the carrier if it isn't null

            if (loadResult.carrier !== null) {
                let carrierResult = await h.getBoatFromID(loadResult.carrier.id)
                let carrier = new Boat(carrierResult, req);
                loadResult.carrier = carrier.getBoatWithoutLoads();
            }
            res.status(200).json({
                id: loadResult.id,
                volume: loadResult.volume,
                carrier: loadResult.carrier,
                content: loadResult.content,
                creation_date: loadResult.creation_date,
                self: loadResult.self
            });
        }

    }
});

// DELETE A LOAD

router.delete('/:load_id', async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.load_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The load_id you specified is not valid."
        })
    }

    let load_id = req.params.load_id;

    // Get the load to see if it has a carrier
    let loadKey = datastore.key(['Load', datastore.int(load_id)]);
    let [loadResult] = await datastore.get(loadKey);

    // See if load was valid
    if (loadResult === undefined) {
        res.status(404).json({
            Error: "No load with this load_id exists"
        })

    // If the load is valid...
    } else {

        // Check the load for a carrier
        if (loadResult.carrier === null) {
            
            // If it doesn't have a carrier, delete the load, and send a 204.
            datastore.delete(loadKey);
            res.status(204).json();
        } else {

            // If it does have a carrier...

            let [boatResult] = await datastore.get(loadResult.carrier);

            // Make sure the owner is doing the change

            if (!req.authenticated)
            {
                return res.status(401).json({
                    Error: "You must authenticate before modifying an embarked load."
                })
            }

            if (boatResult.owner !== req.sub) {
                return res.status(403).json({
                    Error: "Only the boat owner can manipulate loads that are embarked on their boat."
                })
            }

            let newBoat = {
                name: boatResult.name,
                type: boatResult.type,
                length: boatResult.length,
                loads: boatResult.loads.filter(load => load.id !== loadKey.id),
                owner: boatResult.owner,
            }
            let entity = {
                key: loadResult.carrier,
                data: newBoat
            }

            // Update the carrier (boat) to not have this load
            await datastore.update(entity);

            // Delete the load
            await datastore.delete(loadKey);
            res.status(204).json();
        }
    }
})

/**
 * DELETE ALL LOADS (405 SENT)
 */
 router.delete('/', (req,res) => {
    let code = 405
    let error = {Error: "You cannot delete all loads."}
    res.setHeader('Allow', 'GET, POST')
    return res.status(code).json(error)
})

// GET ALL LOADS

router.get('/', m.clientMustAcceptJSON, async (req, res) => {
    
    let query = datastore.createQuery('Load')

    let [result] = await h.paginate(req, query)

    let loads = result.map(async load => {
        if (!load.hasOwnProperty('next'))
        {
            let newLoad = new Load(load, req);
            return newLoad.getLoad(req);
        }
        return load;

    })

    loads = await Promise.all(loads).then((retrievedLoads) => {
        return retrievedLoads;
    })

    // Add the number of loads
    totalLoads = await h.getNumberOfLoads();
    loads.push({totalLoads})

    return res.status(200).json(loads);
});

// PUT LOADS (CHANGE WHOLE LOAD)

router.put('/:load_id', async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.load_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The load_id you specified is not valid."
        })
    }

    // Create a Key for the Load object
    let key = h.createLoadKey(req.params.load_id);

    // Create a Load object
    let load = new Load(req);
    load.key = key;
    
    // Retrieve the Load object
    // Return error if the boat doesn't exist
    if (await load.get(req) === undefined)
    {   
        let error = {Error: "A load with this load_id was not found."};
        return res.status(404).json(error);
    }
    
    // If the load is on a boat
    if (load.carrier !== null) {

        // Make sure the owner is doing the change
        let boatResult = await datastore.get(load.carrier);

        if (!req.authenticated)
        {
            return res.status(401).json({
                Error: "You must authenticate before modifying an embarked load."
            })
        }

        if (boatResult.owner !== req.sub) {
            return res.status(403).json({
                Error: "Only the boat owner can manipulate loads that are embarked on their boat."
            })
        }
    }

    // Create a new load object, update the load object with desired data, update in DB

    if (load.updateAllFields(req)) 
    {
        await datastore.update({key: load.key, data: load});
        await load.get(req);
        res.setHeader('Location', load.self);
        return res.status(303).json()
    }
    else
    {   
        let error = {Error: "PUTs at this endpoint require that all fields are updated. Use PATCH for partial updates."}
        return res.status(400).json(error)
    }
})

/**
 * PUT ALL LOADS (405 SENT)
 */
 router.put('/', (req,res) => {
    let code = 405
    let error = {Error: "You cannot update all loads."}
    res.setHeader('Allow', 'GET, POST')
    return res.status(code).json(error)
})

// PATCH LOADS (CHANGE PART OF A LOAD)

router.patch('/:load_id', m.clientMustAcceptJSON, async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.load_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The load_id you specified is not valid."
        })
    }

    let loadResult = await h.getLoadFromID(req.params.load_id)

    // Return error if the boat doesn't exist
    if (loadResult === undefined)
    {   
        let error = {Error: "A load with this load_id was not found."};
        return res.status(404).json(error);
    }

    let load = new Load(loadResult, req);

    // If the load is on a boat
    if (load.carrier !== null) {

        // Make sure the owner is doing the change
        let boatResult = await datastore.get(load.carrier);

        if (!req.authenticated)
        {
            return res.status(401).json({
                Error: "You must authenticate before modifying an embarked load."
            })
        }

        if (boatResult.owner !== req.sub) {
            return res.status(403).json({
                Error: "Only the boat owner can manipulate loads that are embarked on their boat."
            })
        }
    }

    // Create a new load object, update the load object with desired data, update in DB

    if (load.updateFields(req)) 
    {
        await load.update()
        await load.get(req);
        return res.status(200).json(await load.getLoad(req))
    }
    else
    {   
        let error = {Error: "No properties of the load were included in the body of the request."}
        return res.status(400).json(error)
    }
})

/**
 * PUT ALL LOADS (405 SENT)
 */
 router.patch('/', (req,res) => {
    let code = 405
    let error = {Error: "You cannot update all loads."}
    res.setHeader('Allow', 'GET, POST')
    return res.status(code).json(error)
})

/*  
    EXPORTS
*/
module.exports = router;