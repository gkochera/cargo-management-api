/*
    IMPORTS
*/

var datastore = require('./database');

/*
    HELPER FUNCTIONS
*/

keysAreEqual = (key1, key2) => {
    let id1 = key1.id;
    let id2 = key2.id;

    if (id1 === id2) {
        return true;
    } else {
        return false;
    }
}

pageNumberHandler = (pageNumber, queryKind) => {
    if (pageNumber !== undefined && pageNumber > 1) {
        return datastore.createQuery(queryKind).offset(3 * (pageNumber - 1)).limit(3);
    } else {
        return datastore.createQuery(queryKind).limit(3);
    }
}

module.exports = {keysAreEqual, pageNumberHandler}