
// ------------------------------------------------------ //
// Source
// https://muffinman.io/simple-javascript-api-wrapper
// ------------------------------------------------------ //

// For demo purposes I'm using this awesome Star Wars API
const API_URL = 'http://local.test:9000/api/v1';


// Custom API error to throw
function ApiError(message, data, status) {
    let response = null;
    let isObject = false;

    // We are trying to parse response
    try {
        response = JSON.parse(data);
        isObject = true;
    } catch (e) {
        response = data;
    }

    this.response = response;
    this.message = message;
    this.status = status;
    this.toString = function () {
        return `${this.message}\nResponse:\n${isObject ? JSON.stringify(this.response, null, 2) : this.response}`;
    };
}

// API wrapper function
const fetchResource = (path, userOptions = {}) => {
    // Define default options
    const defaultOptions = {};
    // Define default headers
    const defaultHeaders = {};

    const options = {
        // Merge options
        ...defaultOptions,
        ...userOptions,
        // Merge headers
        headers: {
            ...defaultHeaders,
            ...userOptions.headers
        }
    };

    // Build Url
    const url = `${API_URL}/${path}`;

    // Detect is we are uploading a file
    const isFile = options.body instanceof File;

    // Stringify JSON data
    // If body is not a file
    if (options.body && typeof options.body === 'object' && !isFile) {
        options.body = JSON.stringify(options.body);
    }

    // Variable which will be used for storing response
    let response = null;
    console.log(options);
    return fetch(url, options).
        then(responseObject => {
            // Saving response for later use in lower scopes
            response = responseObject;

            // HTTP unauthorized
            if (response.status === 401) {
                // Handle unauthorized requests
                // Maybe redirect to login page?
                throw new ApiError(`Request failed with status ${response.status}.`, "Problem with your API token, please verify by going to https://www.geodesignhub/api/token/", response.status);
            }
            // HTTP unauthorized
            if (response.status === 400) {
                // Handle unauthorized requests
                // Maybe redirect to login page?
                throw new ApiError(`Request failed with status ${response.status}.`, "Please verify the Project ID, it does not exist or you dont have access to it", response.status);
            }

            // Check for error HTTP error codes
            if (response.status < 200 || response.status >= 300) {
                // Get response as text
                return response.text();
            }

            // Get response as json
            return response.json();
        })
        // "parsedResponse" will be either text or javascript object depending if
        // "response.text()" or "response.json()" got called in the upper scope
        .then(parsedResponse => {
            // Check for HTTP error codes
            if (response.status < 200 || response.status >= 300) {
                // Throw error
                throw parsedResponse;
            }

            // Request succeeded
            return parsedResponse;
        }).
        catch(error => {
            // Throw custom API error
            // If response exists it means HTTP error occured
            if (response) {
                throw new ApiError(`Request failed with status ${response.status}.`, error, response.status);
            } else {
                throw new ApiError(error, null, 'REQUEST_FAILED');
            }
        });
};

// ------------------------------------------------------ //
// DEMO
// PLEASE NOTE:
// this is a very naive implementation for demo purposes
// ------------------------------------------------------ //

// Define API calls

const gdhVerifyProjectCredentials = (projectID, apiToken) => {
    return fetchResource(`projects/${projectID}/`,
        {
            method: 'GET',
            headers: {
                "Authorization": `Token ${apiToken}`,
            },
        });
};

const gdhMigrateDiagramsToProject = (projectID, apiToken, systemID, projectOrPolicy, geoJson) => {
    // return fetchResource(`/${projectID}/`, {'Authorization': "Token " + apiToken });
    console.log("Not implemented yet..");
};



// Get dom nodes

const consoleElement = document.querySelector('#gdh-console');
const verifyCredenditalsBtn = document.querySelector('#verify-gdh-creds-btn');
const migrateDiagramsBtn = document.querySelector('#migrate-diagrams-gdh-btn');

// Create "actions"

function verifyCredentials() {
    // Save button text and set it to loading
    const buttonText = this.innerHTML;
    this.innerHTML = 'Loading...';
    consoleElement.innerHTML = '';
    const gdhApiToken_cont = document.getElementById("gdh-api-token");
    const gdhProjectID_cont = document.getElementById("gdh-project-id");

    let gdhApiToken = "000";
    let gdhProjectID = "000";
    var validated = 0;
    if (gdhApiToken_cont && gdhApiToken_cont.value && gdhProjectID_cont && gdhProjectID_cont.value) {
        validated = 1;
        gdhApiToken = gdhApiToken_cont.value
        gdhProjectID = gdhProjectID_cont.value

    } else {
        consoleElement.innerHTML = "Please provide a valid API Token and Project ID";
    }
    if (validated) {
        gdhVerifyProjectCredentials(gdhProjectID, gdhApiToken).
            then(data => {
                consoleElement.innerHTML = `<div>${JSON.stringify(data, null, 2)}</div>${consoleElement.innerHTML}`;
                // Reset button text
                this.innerHTML = buttonText;
                
                                
                if(migrateDiagramsBtn.classList.contains('hide')) {
                    // remove the class
                    migrateDiagramsBtn.classList.remove('hide');
                }
            }).
            catch(error => {
                consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;
                // Reset button text
                this.innerHTML = buttonText;
            });
    } else {
        this.innerHTML = buttonText;
    }
}

function migrateIGCDiagrams() {
    // Save button text and set it to loading
    const buttonText = this.innerHTML;
    this.innerHTML = 'Loading...';
    consoleElement.innerHTML = '';
    const gdhApiToken = document.getElementById("gdh-api-token").value;
    const gdhProjectID = document.getElementById("gdh-project-id").value;


    gdhMigrateDiagramsToProject(gdhProjectID, gdhApiToken).
        then(data => {
            consoleElement.innerHTML = `<div>${JSON.stringify(data, null, 2)}</div>${consoleElement.innerHTML}`;
            // Reset button text
            this.innerHTML = buttonText;
        }).
        catch(error => {
            consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;
            // Reset button text
            this.innerHTML = buttonText;
        });
}

function request404() {
    // Save button text and set it to loading
    const buttonText = this.innerHTML;
    this.innerHTML = 'Loading...';

    getPerson('not-found').
        then(() => {
            // Skipping as it will always fail
        }).
        catch(error => {
            consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;
            // Reset button text
            this.innerHTML = buttonText;
        });
}

function requestJsonError() {
    // Save button text and set it to loading
    const buttonText = this.innerHTML;
    this.innerHTML = 'Loading...';

    getJsonError().
        then(() => {
            // Skipping as it will always fail
        }).
        catch(error => {
            // Escaping HTML
            const errorContent = document.createElement('div');
            errorContent.innerText = error;

            consoleElement.innerHTML = `<div>${errorContent.innerHTML}</div>${consoleElement.innerHTML}`;
            // Reset button text
            this.innerHTML = buttonText;
        });
}

// Bind actions to buttons

verifyCredenditalsBtn.addEventListener('click', verifyCredentials);
migrateDiagramsBtn.addEventListener('click', migrateIGCDiagrams);