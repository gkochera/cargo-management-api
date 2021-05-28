/**
 * Author: George Kochera
 * Date: 5/28/2021
 * File: tests.js
 * Description: Verification tests for Postman
 */

// Tests the response code
Object.prototype.validateResponseCode = function(code, pm){
    pm.test(`Test request status of ${pm.info.requestName}, expected ${code}, received ${pm.response.code}`, function(){
        pm.expect(pm.response.code).to.be.equal(code);
    });
}

// Tests a header for a value
Object.prototype.validateHeader = function(headerKey, headerValue, pm){
    pm.test(`'${headerKey}' header set to '${headerValue}'.`, () => {
        pm.expect(pm.request.getHeaders()[`${headerKey}`]).to.equal(`${headerValue}`)
    });
}

// Tests that a body is empty
Object.prototype.emptyBody = (pm) => {
    pm.test("Body is Empty", () => {
        pm.expect(pm.response.size().body).to.equal(0);
    })
}

// Tests that the body is JSON.
Object.prototype.bodyIsJSON = (pm) => {
    pm.test("Body is JSON", () => {
        let isJSON = true;
        try
        {
            pm.response.json()
        } catch (e) {
            isJSON = false;
        }
        pm.expect(isJSON).to.be.true;
    })
}

// Tests for the correct body by taking an object and testing each key/value pair
Object.prototype.bodyIsValid = (pm, object) => {
    let desiredKeys = Object.keys(object);

    desiredKeys.map(key => {
        let dKey = key;
        let dValue = object[key];
        
        pm.test(`Body contains key '${dKey}' with value '${dValue}'`, function() {
            pm.expect(pm.response.json()[dKey]).to.equal(dValue);
        })
    })
}

// Tests for error message being correct
Object.prototype.validErrorMessage = (pm, emsg) => {
    pm.test("Error Message is Correct", function () {
        pm.expect(pm.response.json()).to.deep.equal({
            Error: emsg
        })
    });
}