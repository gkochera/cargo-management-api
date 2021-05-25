/*
    IMPORTS
*/
var datastore = require('./database');
var express = require('express')
var router = express.Router();


/*
    ROUTES
*/

// CREATE A LOAD 

router.post('/', async (req, res) => {

    // Verify the incoming body has a volume, content and creation_date
    if (!req.body.volume || !req.body.content || !req.body.creation_date) {
        res.status(400).json({
            Error: "The request object is missing at least one of the required attributes"
        })
    }

    // If it does..
    else {

        // Construct the key and data for the datastore query
        var loadKey = datastore.key('Load');
        var load = {
            volume: parseInt(req.body.volume),
            content: req.body.content,
            creation_date: req.body.creation_date,
            carrier: null
        }
        var entity = {
            key: loadKey,
            data: load
        }

        // Insert the new load
        await datastore.insert(entity);

        // Now get the load back so we can display it
        const [loadResult] = await datastore.get(loadKey);

        // Add the id and self fields
        loadResult["id"] = loadResult[datastore.KEY].id.toString();
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + loadResult[datastore.KEY].id;
        loadResult["self"] = self;

        // Send the new load back to the user
        res.status(201).json({
            id: loadResult.id,
            volume: loadResult.volume,
            carrier: loadResult.carrier,
            content: loadResult.content,
            creation_date: loadResult.creation_date,
            self: loadResult.self
        })
    }
})



// GET A LOAD

router.get('/:load_id', async (req, res) => {
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
                let [carrierResult] = await datastore.get(loadResult.carrier);
                carrierResult["id"] = carrierResult[datastore.KEY].id
                carrierResult["self"] = req.protocol + "://" + req.get("host") + "/boats/" + carrierResult[datastore.KEY].id;
                loadResult.carrier = {
                    id: carrierResult.id,
                    self: carrierResult.self,
                    name: carrierResult.name
                }
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

            // Update the carrier (boat) to not have this load
            let [boatResult] = await datastore.get(loadResult.carrier);
            let newBoat = {
                name: boatResult.name,
                type: boatResult.type,
                length: boatResult.length,
                loads: boatResult.loads.filter(load => load.id !== loadKey.id)
            }
            let entity = {
                key: loadResult.carrier,
                data: newBoat
            }
            await datastore.update(entity);

            // Delete the load
            await datastore.delete(loadKey);
            res.status(204).json();
        }
    }
})

// GET ALL LOADS

router.get('/', async (req, res) => {
    let pageNumber = req.query.page
    
    // Create and run a query to get all the boats
    let loadQuery = pageNumberHandler(pageNumber, 'Load')
    const loadResults = await datastore.runQuery(loadQuery);
    
    // Hacky workaround to see if there are results on the next page
    // Google Cloud has a weird bug where 'moreResults' is always === MORE_RESULTS_AFTER_LIMIT
    // Bug Link: https://github.com/googleapis/google-cloud-datastore/issues/130
    let nextloadQuery = pageNumberHandler(parseInt(pageNumber) + 1, 'Boat')
    const nextLoadResults = await datastore.runQuery(nextloadQuery);

    // Add the next property if required (based on the next page actually having results)
    if (nextLoadResults[0].length) {
        if (pageNumber === undefined) {
            loadResults[0].push({
                "next": req.protocol + "://" + req.get("host") + req.baseUrl + "?page=2"
            })
        } else {
            loadResults[0].push({
                "next": req.protocol + "://" + req.get("host") + req.baseUrl + "?page=" + (parseInt(pageNumber) + 1)
            })
        }

    }

    // Add the 'id' and 'self' property to each of the boat objects.
    const [loads] = loadResults;
    
    let newLoads = await Promise.all(loads.map(async entity => {
        if (!(entity.hasOwnProperty("next"))) {
            let id = entity[datastore.KEY].id
            let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + entity[datastore.KEY].id;
            let carrier = null;
            if (entity.carrier !== null) {
                let [boatResult] = await datastore.get(entity.carrier);
                carrier = {
                    id: boatResult[datastore.KEY].id,
                    name: boatResult.name,
                    self: req.protocol + "://" + req.get("host") + "/boats/" + boatResult[datastore.KEY].id
                }
            }
            return {
                id,
                volume: entity.volume,
                carrier,
                content: entity.content,
                creation_date: entity.creation_date,
                self
            }
        } else {
            return entity
        }

    }))

    // Return the result
    res.status(200).json(newLoads);
});

/*  
    EXPORTS
*/
module.exports = router;