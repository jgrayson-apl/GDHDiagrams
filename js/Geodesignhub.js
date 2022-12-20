// ------------------------------------------------------ //
// Source
// https://muffinman.io/simple-javascript-api-wrapper
// ------------------------------------------------------ //

/**
 * DIAGRAM READER
 */
import DiagramReader from './DiagramReader.js';

// NEW INSTANCE OF DIAGRAM READER //
const diagramReader = new DiagramReader();
diagramReader.initialize().then(({portal}) => {
  console.info('DiagramReader::initialize', portal, diagramReader);

  /*diagramReader.addEventListener('portal-group-selected', ({detail: {portalGroup}}) => {
    console.info('DiagramReader:::portal-group-selected', portalGroup, diagramReader);
  });*/

  /*diagramReader.addEventListener('portal-item-selected', ({detail: {portalItem}}) => {
    console.info('DiagramReader:::portal-item-selected', portalItem, diagramReader);
  });*/

  diagramReader.addEventListener('geoplanner-features', ({detail: {sourceScenarioFeaturesGeoJSON}}) => {
    console.info('DiagramReader:::geoplanner-features', sourceScenarioFeaturesGeoJSON, diagramReader);

    //
    // ONCE WE HAVE ALL THE SOURCE SCENARIO FEATURES WE'LL HAVE ORGANIZE THE THEM INTO GDH DIAGRAMS
    // BASED ON THE SYSTEM, PROJECT/POLICY, ETC... WHICH WILL LIKELY RESULT IN MORE DIAGRAMS THAN
    // SOURCE SCENARIO FEATURES
    //
    const designFeaturesAsEsriJSON = negotiate_in_geodesign_hub(sourceScenarioFeaturesGeoJSON);

    // TESTING: DON'T TRANSFER ALL FEATURES OVER...
    const ignoreUpdate = true;
    if (!ignoreUpdate) {
      //
      // ONCE NEGOTIATED, WE'LL HAVE TO SEND THEM BACK AS A NEW SCENARIO
      //
      diagramReader.createNewGeoPlannerScenario({designFeaturesAsEsriJSON}).then(({newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs}) => {
        console.info('DiagramReader:::createNewGeoPlannerScenario', newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs, diagramReader);

      });
    }
  });

});

/**
 *
 * *** DO NOT USE ***
 *  NOTE: JUST A DUMMY METHOD SO NO ERRORS ARE NOT THROWN
 *
 * @param {{}[]} features
 * @returns {Graphic[]}
 */
function negotiate_in_geodesign_hub(features) {
  return features.map(feature => {
    return {
      attributes: {...feature.properties},
      geometry: Terraformer.geojsonToArcGIS(feature.geometry)
    };
  });
}

// TODO: Change this to live GDH URL.
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
    return `${ this.message }\nResponse:\n${ isObject ? JSON.stringify(this.response, null, 2) : this.response }`;
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
  const url = `${ API_URL }/${ path }`;

  // Detect is we are uploading a file
  const isFile = options.body instanceof File;

  // Stringify JSON data
  // If body is not a file
  if (options.body && typeof options.body === 'object' && !isFile) {
    options.body = JSON.stringify(options.body);
  }

  // Variable which will be used for storing response
  let response = null;
  return fetch(url, options).then(responseObject => {
    // Saving response for later use in lower scopes
    response = responseObject;

    // HTTP unauthorized
    if (response.status === 401) {
      // Handle unauthorized requests
      // Maybe redirect to login page?
      throw new ApiError(`Request failed with status ${ response.status }.`, "Problem with your API token, please verify by going to https://www.geodesignhub/api/token/", response.status);
    }
    // HTTP unauthorized
    if (response.status === 400) {
      // Handle unauthorized requests
      // Maybe redirect to login page?
      throw new ApiError(`Request failed with status ${ response.status }.`, "Please verify the Project ID, it does not exist or you dont have access to it", response.status);
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
  }).catch(error => {
    // Throw custom API error
    // If response exists it means HTTP error occured
    if (response) {
      throw new ApiError(`Request failed with status ${ response.status }.`, error, response.status);
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
  return fetchResource(`projects/${ projectID }/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${ apiToken }`
      }
    });
};

const gdhVerifyProjectSystems = (projectID, apiToken) => {
  return fetchResource(`projects/${ projectID }/systems/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${ apiToken }`
      }
    });
};

const gdhMigrateDiagramsToProject = (projectID, apiToken, systemID, projectOrPolicy, postJson) => {
  // return fetchResource(`/${projectID}/`, {'Authorization': "Token " + apiToken });
  console.log("Not implemented yet..");
  return fetchResource(`projects/${ projectID }/systems/${ systemID }/add/${ projectOrPolicy }`,
    {
      method: 'POST',
      headers: {
        "Authorization": `Token ${ apiToken }`,
        "content-type": "application/json"
      },
      json: postJson
    });

};

// Get dom nodes

const consoleElement = document.querySelector('#gdh-console');
const verifyCredenditalsBtn = document.querySelector('#verify-gdh-creds-btn');
const migrateDiagramsBtn = document.querySelector('#migrate-diagrams-gdh-btn');

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
    gdhApiToken = gdhApiToken_cont.value;
    gdhProjectID = gdhProjectID_cont.value;

  } else {
    consoleElement.innerHTML = "Please provide a valid API Token and Project ID";
  }
  if (validated) {
    // Check if the API token and the project works (the user has access to the project and the project is of the right tpype)
    gdhVerifyProjectCredentials(gdhProjectID, gdhApiToken).then(data => {
      if (data.external_connection !== 'esri') {
        consoleElement.innerHTML = `<div>${ JSON.stringify(data, null, 2) }</div>${ consoleElement.innerHTML }<br>The project is not a ESRI workspace project in Geodesignhub, we cannot migrate data at this time.`;
        // Reset button text
        this.innerHTML = buttonText;

      } else {
        gdhVerifyProjectSystems(gdhProjectID, gdhApiToken).then(systemsData => {
          const validSystemColors = [{'name': 'ENE', 'color': "#AB507E"}, {'name': 'AG', 'color': "#D9CD91"}, {'name': 'FOR', 'color': "#80BD75"}, {'name': 'OCN', 'color': "#8CCDD1"}, {'name': 'STL', 'color': "#E6564E"}, {'name': 'IND', 'color': "#916DA3"}, {'name': 'TRAN', 'color': "#706666"}, {'name': 'WAT', 'color': "#6B9CB0"}];
          let allSysNameColorsFound = [];
          for (let x1 = 0; x1 < validSystemColors.length; x1++) {
            const currentSystemToCheck = validSystemColors[x1];
            const exists = systemsData.filter(function (singleSystem) {
              return singleSystem.sysname === currentSystemToCheck['name'] && singleSystem.syscolor === currentSystemToCheck['color'];
            });
            if (exists) {
              allSysNameColorsFound.push(1);
            } else {
              allSysNameColorsFound.push(0);
            }
          }

          const isAllOne = allSysNameColorsFound.every(item => item === 1);
          if (isAllOne) {
            consoleElement.innerHTML = `<div>Project successfully verified, ready for data migration..</div>${ consoleElement.innerHTML }`;
            // Reset button text
            this.innerHTML = buttonText;
            if (migrateDiagramsBtn.classList.contains('hide')) {                        // remove the class
              migrateDiagramsBtn.classList.remove('hide');
            }
          } else {

            consoleElement.innerHTML = "Geodesignhub project is not setup correctly, please contact your administrator";
          }
        }).catch(error => {
          consoleElement.innerHTML = `<div>${ error }</div>${ consoleElement.innerHTML }`;

          this.innerHTML = buttonText;
          // Reset button text
        });
      }
    }).catch(error => {
      consoleElement.innerHTML = `<div>${ error }</div>${ consoleElement.innerHTML }`;
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
  this.innerHTML = 'Processing...';
  consoleElement.innerHTML = '';
  const gdhApiToken = document.getElementById("gdh-api-token").value;
  const gdhProjectID = document.getElementById("gdh-project-id").value;

  gdhMigrateDiagramsToProject(gdhProjectID, gdhApiToken).then(data => {
    console.log(data);
    consoleElement.innerHTML = `<div>${ JSON.stringify(data, null, 2) }</div>${ consoleElement.innerHTML }`;
    // Reset button text
    this.innerHTML = buttonText;

    // var json = { "featuretype": "polygon", "description": diagname, "geometry": gj, "fundingtype":fundingtype };

  }).catch(error => {
    consoleElement.innerHTML = `<div>${ error }</div>${ consoleElement.innerHTML }`;
    // Reset button text
    this.innerHTML = buttonText;
  });
}

function request404() {
  // Save button text and set it to loading
  const buttonText = this.innerHTML;
  this.innerHTML = 'Loading...';

  getPerson('not-found').then(() => {
    // Skipping as it will always fail
  }).catch(error => {
    consoleElement.innerHTML = `<div>${ error }</div>${ consoleElement.innerHTML }`;
    // Reset button text
    this.innerHTML = buttonText;
  });
}

function requestJsonError() {
  // Save button text and set it to loading
  const buttonText = this.innerHTML;
  this.innerHTML = 'Loading...';

  getJsonError().then(() => {
    // Skipping as it will always fail
  }).catch(error => {
    // Escaping HTML
    const errorContent = document.createElement('div');
    errorContent.innerText = error;

    consoleElement.innerHTML = `<div>${ errorContent.innerHTML }</div>${ consoleElement.innerHTML }`;
    // Reset button text
    this.innerHTML = buttonText;
  });
}

// Bind actions to buttons

verifyCredenditalsBtn.addEventListener('click', verifyCredentials);
migrateDiagramsBtn.addEventListener('click', migrateIGCDiagrams);
