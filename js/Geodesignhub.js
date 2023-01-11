// ------------------------------------------------------ //
// Source
// https://muffinman.io/simple-javascript-api-wrapper
// ------------------------------------------------------ //

/**
 * DIAGRAM READER
 */
import DiagramReader from './DiagramReader.js';

/**
 *
 * *** DO NOT USE ***
 *  NOTE: JUST A DUMMY METHOD SO ERRORS ARE NOT THROWN
 *
 * @param {{}[]} features
 * @returns {Graphic[]}
 */
function negotiate_in_geodesign_hub(features) {
  return features.map(feature => {
    return {
      attributes: { ...feature.properties },
      geometry: feature.geometry
    };
  });
}

//
//
//
//
//
//
//

// TODO: Change this to live GDH URL.
const API_URL = 'http://local.test:9000/api/v1';
let _gdhNegotiatedDesignJSON = null
// JG //
let _sourceScenarioFeaturesGeoJSON = null;
const useIGCSpecificBridgeExtensions = 1;
let _allGDHSystems = null;
let _allGDHProjectTags = null;
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
  return fetch(url, options).then(responseObject => {
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
    }).catch(error => {
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
const slugify = str =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');


const gdhVerifyProjectCredentials = (projectID, apiToken) => {
  return fetchResource(`projects/${projectID}/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${apiToken}`
      }
    });
};

const gdhVerifyProjectSystems = (projectID, apiToken) => {
  return fetchResource(`projects/${projectID}/systems/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${apiToken}`
      }
    });
};

const gdhGetProjectTags = (projectID, apiToken) => {
  return fetchResource(`projects/${projectID}/tags/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${apiToken}`
      }
    });
};

const gdhGetProjectDesignTeams = (projectID, apiToken) => {
  return fetchResource(`projects/${projectID}/cteams/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${apiToken}`
      }
    });
};

const gdhGetDesignTeamDesigns = (projectID, apiToken, designTeamID) => {
  return fetchResource(`projects/${projectID}/cteams/${designTeamID}/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${apiToken}`
      }
    });
};

const gdhGetDesignESRIJSON = (projectID, apiToken, designTeamID, designID) => {
  return fetchResource(`projects/${projectID}/cteams/${designTeamID}/${designID}/esri/`,
    {
      method: 'GET',
      headers: {
        "Authorization": `Token ${apiToken}`
      }
    });
};

const gdhAssignDiagramTags = (projectID, apiToken, diagramID, postJson) => {

  return fetchResource(`projects/${projectID}/diagrams/${diagramID}/tags/`,
    {
      method: 'POST',
      headers: {
        "Authorization": `Token ${apiToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(postJson)
    });

};

const gdhAssignTagsToDiagram = (projectID, apiToken, systemID, projectOrPolicy, postJson) => {

  return fetchResource(`projects/${projectID}/systems/${systemID}/add/${projectOrPolicy}/`,
    {
      method: 'POST',
      headers: {
        "Authorization": `Token ${apiToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(postJson)
    });

};
// Get dom nodes

const consoleElement = document.querySelector('#gdh-console');
const verifyCredenditalsBtn = document.querySelector('#verify-gdh-creds-btn');
const migrateDiagramsBtn = document.querySelector('#migrate-diagrams-gdh-btn');
const gdhDesignTeamSelectBtn = document.querySelector('#geodesignhub-team-selection-btn');
const migrateGdhDesignBtn = document.querySelector('#geodesignhub-migrate-selected-gdh-desig-btn');
// JG //
const arcGISOnlineSignInBtn = document.querySelector('#verify-ags-btn');

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
        consoleElement.innerHTML = `<div>${JSON.stringify(data, null, 2)}</div>${consoleElement.innerHTML}<br>The project is not a ESRI workspace project in Geodesignhub, we cannot migrate data at this time.`;
        // Reset button text
        this.innerHTML = buttonText;

      } else {
        gdhVerifyProjectSystems(gdhProjectID, gdhApiToken).then(systemsData => {
          const validSystemColors = [{ 'name': 'ENE', 'color': "#AB507E" }, { 'name': 'AG', 'color': "#D9CD91" }, { 'name': 'FOR', 'color': "#80BD75" }, { 'name': 'OCN', 'color': "#8CCDD1" }, { 'name': 'STL', 'color': "#E6564E" }, { 'name': 'IND', 'color': "#916DA3" }, { 'name': 'TRAN', 'color': "#706666" }, { 'name': 'WAT', 'color': "#6B9CB0" }];

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

            consoleElement.innerHTML = `<div>Project successfully verified, ready for data migration..</div>${consoleElement.innerHTML}`;
            // Reset button text
            this.innerHTML = buttonText;
            _allGDHSystems = systemsData;
            if (migrateDiagramsBtn.classList.contains('hide')) {                        // remove the class
              migrateDiagramsBtn.classList.remove('hide');
            }

            gdhGetProjectDesignTeams(gdhProjectID, gdhApiToken).then(cteamData => {

              var teamsSelectionCont = document.getElementById('geodesignhub-teams-list');
              teamsSelectionCont.options.length = 0;
              for (var i = 0; i < cteamData.length; i++) {
                var opt = document.createElement('option');
                opt.setAttribute("id", cteamData[i]['id']);
                opt.innerHTML = cteamData[i]['title'];
                teamsSelectionCont.appendChild(opt);
              }

            }).catch(error => consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`);

            gdhGetProjectTags(gdhProjectID, gdhApiToken).then(tagsData => {
              _allGDHProjectTags = tagsData;
            }).catch(error => consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`);


          } else {

            consoleElement.innerHTML = "Geodesignhub project is not setup correctly, please contact your administrator";
          }
        }).catch(error => {
          consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;

          this.innerHTML = buttonText;
          // Reset button text
        });
      }
    }).catch(error => {
      consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;
      // Reset button text
      this.innerHTML = buttonText;
    });
  } else {
    this.innerHTML = buttonText;
  }
}

function gdhGPLSystemConverter(gplSystem) {
  // This function takes a "Intervention System" from Geoplanner and returns 
  const gplGDHLookup = { 'Agricultural & Forestry': 'AG', 'Energy': 'ENE' };
  let gdhSystemID = 0;
  if (gplGDHLookup.hasOwnProperty(gplSystem)) {
    let gdhSystemName = gplGDHLookup[gplSystem];
    const gdhSystem = _allGDHSystems.filter(function (singleSystem) {
      return singleSystem.sysname === gdhSystemName
    });
    if (gdhSystem.length === 1) { // There should be only one system in a GDH project 
      gdhSystemID = gdhSystem[0]['id'];
    }

  }

  return gdhSystemID;
}

function gdhGPLActionsConverter(gplActions) {
  // This function takes a Climate Action from GPL and returns relevant tags in Geodesignhub
  let gdhTagIDs = [];
  for (let index = 0; index < gplActions.length; index++) {
    const current_action = gplActions[index];
    const action_slug = slugify(current_action);
    const relevantGdhTags = _allGDHProjectTags.filter(function (singleTag) {
      return singleTag.slug === action_slug;
    });

    if (relevantGdhTags.length > 0) {
      for (let tag_index = 0; tag_index < relevantGdhTags.length; tag_index++) {
        const current_tag = relevantGdhTags[tag_index];
        gdhTagIDs.push(current_tag.id);

      }
    }
  }
  return gdhTagIDs;
}

function getDesignsforGDHTeam() {

  const gdhApiToken = document.getElementById("gdh-api-token").value;
  const gdhProjectID = document.getElementById("gdh-project-id").value;
  const designTeamCont = document.getElementById('geodesignhub-teams-list');
  const gdhDesignTeamID = designTeamCont.options[designTeamCont.selectedIndex].id;

  gdhGetDesignTeamDesigns(gdhProjectID, gdhApiToken, gdhDesignTeamID).then(designData => {
    // Skipping as it will always fail

    const designSynthesisData = designData['synthesis'];
    var designSelectionCont = document.getElementById('geodesignhub-team-design-list');
    designSelectionCont.options.length = 0;
    for (var i = 0; i < designSynthesisData.length; i++) {
      var opt = document.createElement('option');
      opt.setAttribute("id", designSynthesisData[i]['id']);
      opt.innerHTML = designSynthesisData[i]['description'];
      designSelectionCont.appendChild(opt);
    }

  }).catch(error => {

  });

}
function getDesignJSONandMigrate() {

  const buttonText = this.innerHTML;
  this.innerHTML = 'Processing...';
  consoleElement.innerHTML = '';
  const gdhApiToken = document.getElementById("gdh-api-token").value;
  const gdhProjectID = document.getElementById("gdh-project-id").value;
  const designTeamCont = document.getElementById('geodesignhub-teams-list');
  var gdhDesignTeamID = designTeamCont.options[designTeamCont.selectedIndex].id;


  const designTeamDesignCont = document.getElementById('geodesignhub-team-design-list');
  var gdhDesignID = designTeamDesignCont.options[designTeamDesignCont.selectedIndex].id;

  gdhGetDesignESRIJSON(gdhProjectID, gdhApiToken, gdhDesignTeamID, gdhDesignID).then(designData => {
    // TODO: Migrate this design to GPL
    _gdhNegotiatedDesignJSON = designData;
    this.innerHTML = 'Migration complete..'


  }).catch(error => {

    consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;
    // Reset button text
    this.innerHTML = buttonText;
  });

}

function migrateIGCDiagrams() {
  // Save button text and set it to loading
  const buttonText = this.innerHTML;
  this.innerHTML = 'Processing...';
  consoleElement.innerHTML = '';
  const gdhApiToken = document.getElementById("gdh-api-token").value;
  const gdhProjectID = document.getElementById("gdh-project-id").value;
  // console.log(_sourceScenarioFeaturesGeoJSON)
  let source_diagrams_len = _sourceScenarioFeaturesGeoJSON.length;
  for (let index = 0; index < source_diagrams_len; index++) {
    const current_diagram_details = _sourceScenarioFeaturesGeoJSON[index];
    const gplSystem = current_diagram_details.properties.Intervention_System;
    const gplInterventionName = current_diagram_details.properties.Intervention_Type;

    const gdhSystemID = gdhGPLSystemConverter(gplSystem);

    const gj = current_diagram_details['geometry'];
    let gj_feature_object = { "type": "Feature", "properties": {}, "geometry": { "type": gj['type'], "coordinates": gj['coordinates'] } }
    let gj_feature_collection = { "type": "FeatureCollection", "features": [gj_feature_object] }
    let geoJSONGeometryType = gj['type'].toLowerCase();

    if (geoJSONGeometryType == 'LineString') {
      geoJSONGeometryType = 'polyline';
    }

    var postJson = { "featuretype": geoJSONGeometryType, "description": gplInterventionName, "geometry": gj_feature_collection };

    if (index == 1) {
      break;
    }

    let gdhRelevantTagIDs = [];
    if (useIGCSpecificBridgeExtensions) {
      gdhRelevantTagIDs = gdhGPLActionsConverter([gplInterventionName]);
    }

    if (gdhSystemID !== 0) {
      gdhMigrateDiagramsToProject(gdhProjectID, gdhApiToken, gdhSystemID, 'project', postJson).then(diagram_data => {
        consoleElement.innerHTML = `<div>${JSON.stringify(data, null, 2)}</div>${consoleElement.innerHTML}`;
        // Reset button text
        this.innerHTML = buttonText;
        return diagram_data
      }).then(diagram_data => {
        // Assign Diagram Tags 
        if (gdhRelevantTagIDs.length > 0) {
          let diagramID = diagram_data['diagram_id'];
          let postJSON = gdhRelevantTagIDs;
          gdhAssignDiagramTags(gdhProjectID, gdhApiToken, diagramID, postJSON).then(tagsAssigned => {
            consoleElement.innerHTML = "Climate Actions successfully assigned to migrated Diagram.."
          })
            .catch(error => consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`);
        }
        // Assign GPL Object ID 

      }).catch(error => {
        consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;
        // Reset button text
        this.innerHTML = buttonText;
      });
    }
  }
}

function request404() {
  // Save button text and set it to loading
  const buttonText = this.innerHTML;
  this.innerHTML = 'Loading...';

  getPerson('not-found').then(() => {
    // Skipping as it will always fail
  }).catch(error => {
    consoleElement.innerHTML = `<div>${error}</div>${consoleElement.innerHTML}`;
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

    consoleElement.innerHTML = `<div>${errorContent.innerHTML}</div>${consoleElement.innerHTML}`;
    // Reset button text
    this.innerHTML = buttonText;
  });
}

function arcGISOnlineSignIn() {

  // NEW INSTANCE OF DIAGRAM READER //
  const diagramReader = new DiagramReader();

  // SIGN IN TO ARCGIS ONLINE //
  diagramReader.signIn().then(({ portal }) => {
    // console.info('DiagramReader::signIn', portal, diagramReader);

    //
    // AFTER WE'RE SIGNED IN WE LISTEN TO WHEN GEOJOSN FEATURES HAVE BEEN RETRIEVED //
    //
    diagramReader.addEventListener('geoplanner-features', ({ detail: { sourceScenarioFeaturesGeoJSON } }) => {
      // console.info('DiagramReader:::geoplanner-features', sourceScenarioFeaturesGeoJSON, diagramReader);

      //
      // SET LOCAL VARIABLE ACCESSIBLE TO OTHER FUNCTIONS //
      //
      _sourceScenarioFeaturesGeoJSON = sourceScenarioFeaturesGeoJSON;
      const gdhMigrationCont = document.getElementById('geodesignhub_migration_cont');
      gdhMigrationCont.removeAttribute("hidden");

      const gdhDesignMigrationDesignTeamSelectionCont = document.getElementById('geodesignhub_to_gpl_migration_design_team_selection_cont');
      gdhDesignMigrationDesignTeamSelectionCont.removeAttribute("hidden");

      const gdhDesignMigrationSelectionCont = document.getElementById('geodesignhub_to_gpl_migration_cont');
      gdhDesignMigrationSelectionCont.removeAttribute("hidden");
      //
      // ONCE WE HAVE ALL THE SOURCE SCENARIO FEATURES WE'LL HAVE ORGANIZE THE THEM INTO GDH DIAGRAMS
      // BASED ON THE SYSTEM, PROJECT/POLICY, ETC... WHICH WILL LIKELY RESULT IN MORE DIAGRAMS THAN
      // SOURCE SCENARIO FEATURES
      //
      const designFeaturesAsEsriJSON = negotiate_in_geodesign_hub(sourceScenarioFeaturesGeoJSON);

      //
      // AFTER THE NEGOTIATIONS ARE COMPLETE WE NEED TO SEND THEM BACK AS A NEW GEOPLANNER SCENARIO
      // WHICH CONSISTS OF A NEW FEATURE LAYER PORTAL ITEM (NOT A NEW SERVICE... JUST A NEW PORTAL
      // ITEM WITH A DEFINITION EXPRESSION) AND NEW FEATURES INTO THE PROJECT FEATURE LAYER.
      //

      // TESTING: DON'T TRANSFER ALL FEATURES OVER...
      const ignoreUpdate = true;
      if (!ignoreUpdate) {
        //
        // ONCE NEGOTIATED, WE'LL HAVE TO SEND THEM BACK AS A NEW SCENARIO
        //
        diagramReader.createNewGeoPlannerScenario({ designFeaturesAsEsriJSON }).then(({ newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs }) => {
          console.info('DiagramReader:::createNewGeoPlannerScenario', newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs, diagramReader);

        }).catch(error => {
          console.error("Diagram Reader createNewGeoPlannerScenario() Error: ", error);
        });
      }
    });

  }).catch(error => {
    console.error("Diagram Reader initialize() Error: ", error);
  });

}

// Bind actions to buttons

verifyCredenditalsBtn.addEventListener('click', verifyCredentials);
migrateDiagramsBtn.addEventListener('click', migrateIGCDiagrams);
gdhDesignTeamSelectBtn.addEventListener('click', getDesignsforGDHTeam);
migrateGdhDesignBtn.addEventListener('click', getDesignJSONandMigrate);
// JG //
arcGISOnlineSignInBtn.addEventListener('click', arcGISOnlineSignIn);
