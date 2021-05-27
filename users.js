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
 * WEB INTERFACE ROUTES
 */


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
        sub: body.names[0].metadata.source.id,
        id_token: res.locals.google.id_token
    }

    // Look for the user in the database
    let query = datastore.createQuery('User')
    .filter('sub', '=', data.sub);
    let [result] = await datastore.runQuery(query);
    
    // See if the user is in the results
    let isInDatabase = (result.length === 0) ? false : true;
    if (!isInDatabase)
    {   
        res.redirect('/?e=2')
        return;
    }

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
        res.redirect('/?e=1')
        return;
    }

    // Add the user to the database if they're not in it
    let newUser = new User(data);
    newUser.insert();

    // Display their information
    res.render('pages/welcome', {data: data})

})

/**
 * API ROUTES
 * ! UNPROTECTED ROUTE !
 */

router.get('/', m.clientMustAcceptJSON, async (req, res) =>{
    let query = datastore.createQuery('User')
    let [result] = await datastore.runQuery(query);
    let users = result.map(user => {
        return new User(user, req, true).getUser();
    })
    let totalUsers = await h.getNumberOfUsers();
    users.push({totalUsers})
    res.status(200).json(users)
})

router.get('/:user_id', m.clientMustAcceptJSON, async (req, res) => {

    // Test for garbage URL parameters
    let screenedVariable = req.params.user_id;
    if (screenedVariable === undefined || isNaN(parseInt(screenedVariable)))
    {
        return res.status(400).json({
            Error: "The user_id you specified is not valid."
        })
    }
    
    let result = await h.getUserFromID(req.params.user_id);
    console.log(result)
    let user = new User(result, req, true)
    res.status(200).json(user.getUser());
})

/**
 * EXPORTS
 */

module.exports = router;