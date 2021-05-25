/**
 * Author: George Kochera
 * Date: 5/10/2021
 * File: boat_class.js
 * Description: Contains all the functions for manipulating, storing and handling Boats
 */

// Boat Object Definition
/*
    { 
      "id": "abc123",                           # Automatically generated by Datastore
      "name": "Sea Witch",                      # The name of the boat, a string
      "type": "Catamaran",                      # The type of the boat, power boat, sailboat, catamaran etc. a string
      "length": 28,                             # The length of the boat
      "public": true,                           # Boolean. true means the boat is public, false means it's private.
      "owner": "auth0|5eb70257",                # The owner of the boat, value of sub property in the JWT
      "self":"https://appspot.com/boats/abc123" # Optional
    }
*/

var http = require('http')
var datastore = require('./database');
var h = require('./helper');

module.exports = class Load
{
    constructor(data, request=null, gDatastore=false)
    {
        if (gDatastore)
        {
            this.id = data[datastore.KEY].id.toString()
            this.volume = data.volume;
            this.carrier = data.carrier;
            this.content = data.content;
            this.creation_date = data.creation_date;
            this.key =  data[datastore.KEY];
            this.self = request.protocol + "://" + request.get("host") + "/loads/" + data[datastore.KEY].id;
        }
        else
        {
            this.id = null;
            this.volume = data.volume;
            this.carrier = null;
            this.content = data.content;
            this.creation_date = data.creation_date;
            this.key = datastore.key('Load');
            this.self = null;
        }
    }


    /**
     * Returns a boat object without metadata
     */
    getLoad() {
        return {
            id: this.id,
            volume: this.volume,
            carrier: this.carrier,
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
}