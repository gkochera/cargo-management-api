/**
 * Author: George Kochera
 * Date: 5/27/2021
 * File: classes.js
 * Description: Contains all the functions for manipulating, storing and handling Boats
 */

// Load Object Definition
/*
    { 
      "id": "abc123",                      
      "volume": "Sea Witch",                 
      "carrier": "Catamaran",                  
      "content": 28,                           
      "creation_date": true,                          
      "self":"https://appspot.com/boats/abc123" 
    }
*/

var http = require('http')
var datastore = require('./database');
var h = require('./helper');

class Load
{
    constructor(data, request=null)
    {

        this.requiredAttributes = ['volume', 'content', 'creation_date']

        if (data instanceof http.IncomingMessage)
        {
            this.id = null;
            this.carrier = null;
            this.volume = data.body.volume;
            this.content = data.body.content;
            this.creation_date = data.body.creation_date;
            this.key = datastore.key('Load');
            this.self = null;
            this.hasAllFields = this._hasAllFields(data);
        }
        else
        {

            this.id = data[datastore.KEY].id.toString()
            this.carrier = data.carrier;
            this.volume = data.volume;
            this.content = data.content;
            this.creation_date = data.creation_date;
            this.key =  data[datastore.KEY];
            this.self = request.protocol + "://" + request.get("host") + "/loads/" + data[datastore.KEY].id;
            this.hasAllFields = true;
        }
    }

    async _retrieveBoat(nodeRequest)
    {

        let [carrierResult] = await datastore.get(this.carrier);
        let carrier = new Boat(carrierResult, nodeRequest);
        this.carrier = carrier.getBoatWithoutLoads();
    }


    /**
     * Returns a load object without metadata
     */
    async getLoad(nodeRequest) {
        if (this.carrier !== null)
        {
            await this._retrieveBoat(nodeRequest);
        }

        return {
            id: this.id,
            volume: this.volume,
            carrier: this.carrier,
            content: this.content,
            creation_date: this.creation_date,
            self: this.self
        }
    }

    /**
     * Returns a load object without metadata or carrier
     */
    getLoadWithoutCarrier() {
        return {
            id: this.id,
            volume: this.volume,
            content: this.content,
            creation_date: this.creation_date,
            self: this.self
        }
    }

    async insert()
    {
        // Construct the key and data for the datastore query
        var entity = {
            key: this.key,
            data: {
                volume: this.volume,
                carrier: this.carrier,
                content: this.content,
                creation_date: this.creation_date,
            }
        }

        // Insert the new boat
        await datastore.insert(entity);
    }

    async update()
    {
        var entity = {
            key: this.key,
            data: {
                volume: this.volume,
                carrier: this.carrier,
                content: this.content,
                creation_date: this.creation_date,
            }
        }

        await datastore.update(entity)
    }

    async get(nodeRequest)
    {
        // Now get the boat back so we can display it
        let [loadResult] = await datastore.get(this.key);
        this.id = loadResult[datastore.KEY].id.toString();
        this.volume = loadResult.volume;
        this.carrier = loadResult.carrier;
        this.content = loadResult.content;
        this.creation_date = loadResult.creation_date;
        this.key = loadResult[datastore.KEY];
        this.self = nodeRequest.protocol + "://" + nodeRequest.get("host") + "/loads/" + loadResult[datastore.KEY].id
    }

    /**
     * Determines if the Boat has all fields filled out.
     * 
     * @returns true if all fields are present.
     */
    _hasAllFields(nodeRequest)
    {
        let nodeRequestBodyKeys = Object.keys(nodeRequest.body);
        return this.requiredAttributes.every(key => nodeRequestBodyKeys.includes(key))
    }

        /**
     * Updates the fields in a Boat object.
     * @param {req.body} requestBody An express req.body object.
     * @returns true if at least one field is present.
     */
    updateFields(request)
    {
        let keys = Object.keys(request.body);

        if (keys.length < 1)
        {
            return false;
        }

        keys.map(key => {
            if (this.hasOwnProperty(key))
            {
                this[key] = request.body[key];
            }
        })

        // Ensure users can't try to circumvent integer constraint
        this["length"] = parseInt(this["length"], 10);
        
        return true;
    }
    
    /**
     * Updates all fields in a boat object. If all fields are not included in the request body this function will fail.
     * @param {req.body} requestBody 
     * @returns true iff all fields are inlcuded in the request body.
     */
    updateAllFields(request)
    {
        if (!this._hasAllFields(request))
        {
            return false;
        }
        else
        {
            return this.updateFields(request);
        }
    }

    async unloadFromBoat()
    {
        // Update the carrier (boat) to not have this load
        let newBoat = {
            name: boatResult.name,
            type: boatResult.type,
            length: boatResult.length,
            loads: boatResult.loads.filter(load => load.id !== this.id)
        }
        let entity = {
            key: this.carrier,
            data: newBoat
        }
        await datastore.update(entity);
    }
}

// Boat Object Definition
/*
    { 
      "id": "abc123",                           # Automatically generated by Datastore
      "name": "Sea Witch",                      # The name of the boat, a string
      "type": "Catamaran",                      # The type of the boat, power boat, sailboat, catamaran etc. a string
      "length": 28,                             # The length of the boat
      "owner": "auth0|5eb70257",                # The owner of the boat, value of sub property in the JWT
      "self":"https://appspot.com/boats/abc123" # Optional
    }
*/

class Boat
{
    constructor(data, request=null)
    {   
        if (data instanceof http.IncomingMessage)
        {
            this.id = null
            this.name = data.body.name;
            this.type = data.body.type;
            this.length = parseInt(data.body.length, 10);
            this.owner = data.sub;
            this.self = null;
            this.loads = [],
            this.key = datastore.key('Boat');
            this.requiredAttributes = ['name', 'type', 'length']
            this.hasAllFields = this._hasAllFields(data);
        }
        else 
        {
            this.id = data[datastore.KEY].id.toString()
            this.name = data.name;
            this.type = data.type;
            this.length = parseInt(data.length, 10);
            this.owner = data.owner;
            this.self = request.protocol + "://" + request.get("host") + "/boats/" + data[datastore.KEY].id;
            this.loads = data.loads;
            this.key = h.createBoatKey(this.id)
            this.requiredAttributes = ['name', 'type', 'length']
            this.hasAllFields = true;
            
        }

    }

    /**
     * Determines if the Boat has all fields filled out.
     * 
     * @returns true if all fields are present.
     */
    _hasAllFields(nodeRequest)
    {
        let nodeRequestBodyKeys = Object.keys(nodeRequest.body);
        return this.requiredAttributes.every(key => nodeRequestBodyKeys.includes(key))
    }

    /**
     * Retrieves all the loads for the boat
     */
    async _retrieveLoads(nodeRequest)
    {
        // Get the actual load for each of the stored load keys
        this.loads = await Promise.all(this.loads.map(async (load) => {
            let [loadResult] = await datastore.get(load);
            let loadObject = new Load(loadResult, nodeRequest);

            return loadObject.getLoadWithoutCarrier();
        }));
    }

    /**
     * Updates the fields in a Boat object.
     * @param {req.body} requestBody An express req.body object.
     * @returns true if at least one field is present.
     */
    updateFields(request)
    {
        let keys = Object.keys(request.body);

        if (keys.length < 1)
        {
            return false;
        }

        keys.map(key => {
            if (this.hasOwnProperty(key))
            {
                this[key] = request.body[key];
            }
        })

        // Ensure users can't try to circumvent integer constraint
        this["length"] = parseInt(this["length"], 10);
        
        return true;
    }
    
    /**
     * Updates all fields in a boat object. If all fields are not included in the request body this function will fail.
     * @param {req.body} request 
     * @returns true iff all fields are inlcuded in the request body.
     */
    updateAllFields(request)
    {
        if (!this._hasAllFields(request))
        {
            return false;
        }
        else
        {
            return this.updateFields(request);
        }
    }

    /**
     * Returns a boat object without metadata
     */
    async getBoat(nodeRequest) {
        await this._retrieveLoads(nodeRequest);
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            length: this.length,
            loads: this.loads,
            owner: this.owner,
            self: this.self
        }
    }

    /**
     * Returns a boat object without metadata or loads
     */
    getBoatWithoutLoads() {
    return {
        id: this.id,
        name: this.name,
        type: this.type,
        length: this.length,
        owner: this.owner,
        self: this.self
    }
}

    async insert()
    {
        // Construct the key and data for the datastore query
        var entity = {
            key: this.key,
            data: {
                name: this.name,
                type: this.type,
                length: this.length,
                loads: this.loads,
                owner: this.owner
            }
        }
        // Insert the new boat
        await datastore.insert(entity);
    }

    async update()
    {
        var entity = {
            key: this.key,
            data: {
                name: this.name,
                type: this.type,
                length: this.length,
                loads: this.loads,
                owner: this.owner
            }
        }

        await datastore.update(entity)
    }

    async get(nodeRequest)
    {
        // Now get the boat back so we can display it
        let [boatResult] = await datastore.get(this.key);
        this.id = boatResult[datastore.KEY].id.toString();
        this.name = boatResult.name;
        this.type = boatResult.type;
        this.length = boatResult.length;
        this.loads = boatResult.loads;
        this.owner = boatResult.owner;
        this.self = nodeRequest.protocol + "://" + nodeRequest.get("host") + "/boats/" + boatResult[datastore.KEY].id
    }

    async removeAllLoads()
    {

        // Update the loads to not have a carrier
        await this.loads.forEach(async load => {
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
    }

    async removeLoad(loadKey)
    {
        // Get all the loads from datastore
        this.loads = this.loads.filter(load => load !== loadKey)

        await this.update();


    }
}

module.exports = {
    Boat,
    Load
}