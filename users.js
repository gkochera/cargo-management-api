/**
 * Author: George Kochera
 * Date: 4/30/21
 * File: owners.js
 * Description: Contains all the /owners route handlers.
 */

/*
    IMPORTS
*/
var User = require('./user_class')
var datastore = require('./database');
var express = require('express')
var router = express.Router();
var h = require('./helper');
var m = require('./middleware');

/**
 * LOGIN ROUTE
 */
router.get('/login', m.authenticate, m.getToken, async (req, res) => {
    // Because we use the 'authenticate' middleware
    // we can guarantee we will have a code, and because
    // we use the 'getToken' middleware, we can guarantee we have
    // a request token. At this point, we just need the data.
    let googleResponse = await h.getGoogleInformation(res)
    let body = JSON.parse(googleResponse.body)
    let data = {
        firstName: body.names[0].givenName,
        lastName: body.names[0].familyName,
        state: req.cookies.state,
        id_token: res.locals.google.id_token
    }
    console.log(body);

    // See if the user is in the database
    let query = datastore.createQuery('User')
    .filter('sub', '=', req.sub);
    // If they arent, add them

    // Render the page
    res.render('pages/userinfo', {data: data})
})

/**
 * NEW USER ROUTE
 */
router.get('/signup', m.authenticate, m.getToken, async (req, res) => {

    // The user will authenticate with Google at first, we gather their profile
    let googleResponse = await h.getGoogleInformation(res)
    let body = JSON.parse(googleResponse.body)
    let data = {
        firstName: body.names[0].givenName,
        lastName: body.names[0].familyName,
        state: req.cookies.state,
        sub: body.names[0].metadata.source.id,
        id_token: res.locals.google.id_token
    }
    
    // Look for the user in the database
    let query = datastore.createQuery('User')
    .filter('sub', '=', data.sub);
    let [result] = await datastore.runQuery(query);
    

    // See if the user is in the results
    let isInDatabase = (result.length === 0) ? false : true;
    if (isInDatabase)
    {
        res.render('pages/userinfo', {data: data, message: "alreadyRegistered"})
        return;
    }

    // Add the user to the database if they're not in it
    let newUser = new User(data.sub, data.firstName, data.lastName);
    newUser.insert();

    // Display their information
    res.render('pages/welcome', {data: data})

})

/**
 * EXPORTS
 */

module.exports = router;