/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

class DiagramReader extends EventTarget {

  static CONFIG = {
    PORTAL_URL: "https://www.arcgis.com",
    OAUTH_APP_ID: "PZdAgiu187TroTCX",
    GEODESIGNHUB_TOKEN: "c0ae02b64a7e0ca453231143ae2fe2d8202e51e8"
  };

  /**
   *
   */
  constructor() {
    super();

    // GEODESIGNHUB API ACCESS TOKEN //
    if(DiagramReader.CONFIG.GEODESIGNHUB_TOKEN?.length) {
      const gdhApiToken = document.getElementById('gdh-api-token');
      gdhApiToken.value = DiagramReader.CONFIG.GEODESIGNHUB_TOKEN;
    }

    // INITIALIZE PORTAL //
    this.initializeApplication().then(({portal}) => {

      // SIGNED-IN USER LABEL //
      const signInUserLabel = document.getElementById('sign-in-user-label');
      signInUserLabel.innerHTML = portal.user?.username || '[ not signed in ]';

      // FIND ALL IGC GEOPLANNER LAYERS AND SELECT THE FIRST ONE //
      this.initializeGeoPlannerLayers({portal});

      // TOGGLE PANE SECTIONS //
      document.querySelectorAll('.pane').forEach(paneNode => {
        paneNode.querySelector('.toggle')?.addEventListener('click', () => {
          paneNode.classList.toggle('collapsed');
        });
      });

    });

  }

  /**
   *
   * IdentityManager: https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-IdentityManager.html
   * OAuthInfo: https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-OAuthInfo.html
   * Portal: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-Portal.html
   *
   * @returns {Promise<Portal>}
   */
  initializeApplication() {
    return new Promise((resolve, reject) => {
      require([
        'esri/identity/IdentityManager',
        'esri/identity/OAuthInfo',
        'esri/portal/Portal'
      ], (esriId, OAuthInfo, Portal) => {

        // CONFIGURE OAUTH //
        const oauthInfo = new OAuthInfo({
          portalUrl: DiagramReader.CONFIG.PORTAL_URL,
          appId: DiagramReader.CONFIG.OAUTH_APP_ID,
          popup: true
        });
        esriId.registerOAuthInfos([oauthInfo]);

        // PORTAL //
        //  - IGC ORG IN ARCGIS.COM
        const portal = new Portal({url: DiagramReader.CONFIG.PORTAL_URL});

        // SHARING URL //
        const portalSharingURL = `${ DiagramReader.CONFIG.PORTAL_URL }/sharing`;

        // CHECK THE SIGN-IN STATUS
        esriId.checkSignInStatus(portalSharingURL).then(() => {
          return esriId.getCredential(portalSharingURL);
        }).catch(() => {
          // IF USER IS NOT ALREADY SIGNED-IN IN THE BROWSER THEN ASK THE USER TO SIGN IN NOW... //
          portal.authMode = 'immediate';
        }).then(() => {
          // LOAD PORTAL //
          portal.load().then(() => {
            console.info(`Signed in user: ${ portal.user?.username || 'none' }`);
            resolve({portal});
          }).catch(reject);
        });
      });

    });
  }

  /**
   *
   * @param {Portal} portal
   * @returns {Promise<PortalItem[]>}
   * @private
   */
  _displayPortalItemsList({portal}) {
    return new Promise((resolve, reject) => {

      const portalItemsList = document.getElementById('geoplanner-items-list');

      //
      // ASK PORTAL TO RETURN PORTAL ITEMS
      //  - items with these tags: IGC | geodesign | geodesignScenario
      //
      portal.queryItems({
        query: 'tags:(IGC AND geodesign AND geodesignScenario NOT gdhtest)', // APPENDED GDHTEST TAG JUST FOR TESTING THIS APP //
        sortField: 'modified',
        sortOrder: 'desc',
        num: 100
      }).then(({results}) => {

        // LAYER PORTAL ITEMS //
        // - A PORTAL ITEM REPRESENTS THE SIMPLE METADATA ABOUT A GIS THING (MAP, LAYER, ETC...)
        //   AND IN THIS CASE WE'RE JUST INTERESTED IN THE FEATURE LAYERS...
        const layerPortalItems = results.filter(item => item.isLayer);

        // GEOPLANNER DESIGN LAYERS ITEMS //
        const layerItemNodes = layerPortalItems.map(layerPortalItem => {

          const layerItemNode = document.createElement('div');
          layerItemNode.classList.add('layer-item');
          layerItemNode.innerHTML = `[${ layerPortalItem.id }] ${ layerPortalItem.title }`;

          return layerItemNode;
        });

        // DISPLAY LIST OF ALL GEOPLANNER LAYER ITEMS //
        portalItemsList.replaceChildren(...layerItemNodes);

        resolve({layerPortalItems});
      });
    });
  }

  /**
   * UI - DISPLAY LIST OF FEATURES
   *
   * @param {HTMLElement} container
   * @param {Graphic[]} features
   * @param {boolean} isGeoJSON
   * @returns {Map<string, Graphic[]>}
   * @private
   */
  _displayFeaturesList(container, features, isGeoJSON = false) {

    const diagramBySystems = new Map();

    const diagramItems = features.map(diagramFeature => {

      // DIAGRAM ATTRIBUTES //
      const diagramAttributes = isGeoJSON ? diagramFeature.properties : diagramFeature.attributes;

      // FEATURE ID //
      const oid = isGeoJSON ? diagramFeature.id : diagramAttributes.OBJECTID;

      // RELEVANT FEATURE/DIAGRAM PROPERTIES //
      const {
        Geodesign_ProjectID,
        Geodesign_ScenarioID,
        Intervention_System,
        Intervention_Type
      } = diagramAttributes;

      // FEATURE/DIAGRAM ITEM //
      const diagramItem = document.createElement('div');
      diagramItem.classList.add('diagram-item');
      diagramItem.innerHTML = `[ ${ oid } ] ${ Intervention_System } | ${ Intervention_Type }`;
      diagramItem.title = JSON.stringify(diagramFeature, null, 2);

      const geometryParts = diagramFeature.geometry.coordinates || diagramFeature.geometry.rings;
      const isMultiPartGeometry = (geometryParts.length > 1);
      isMultiPartGeometry && diagramItem.classList.add('multipart');

      // ORGANIZE FEATURES/DIAGRAMS BY SYSTEM //
      const diagramBySystem = diagramBySystems.get(Intervention_System) || [];
      diagramBySystem.push(diagramFeature);
      diagramBySystems.set(Intervention_System, diagramBySystem);

      return diagramItem;
    });
    // ADD DIAGRAMS TO LIST //
    container.replaceChildren(...diagramItems);

    return diagramBySystems;
  }

  /**
   *
   * CREATE A RANDOM SELECTION OF CANDIDATE FEATURES
   *  - SIMILAR AS A SET OF GDH NEGOTIATED DIAGRAMS BECOMES A NEW DESIGN...
   *
   * @param {Graphic[]} features array of features as Esri JS API Graphics
   * @param {number} randomCount
   * @returns {Graphic[]}
   */
  _createRandomScenarioCandidates(features, randomCount = 15) {

    // GET RANDOM CANDIDATE FEATURES //
    const sourceFeatures = [...features];
    const candidateFeatures = [];
    do {
      const candidateIdx = Math.floor(Math.random() * sourceFeatures.length);
      const candidateFeature = sourceFeatures.splice(candidateIdx, 1)[0];
      candidateFeatures.push(candidateFeature);
    } while (candidateFeatures.length < randomCount);

    return candidateFeatures;
  };

  /**
   * THESE ARE UPDATES THAT WILL HAVE TO BE MADE TO ALL SCENARIO FEATURES BEFORE
   * ADDING THEM BACK TO THE FEATURE LAYER
   *
   *
   * @param {Graphic[]} candidateFeatures
   * @param {string} scenarioID
   * @returns {Graphic[]}
   */
  _updateScenarioCandidates(candidateFeatures, scenarioID) {

    // CREATE AN ITEM FOR EACH FEATURE/DIAGRAM //
    return candidateFeatures.map(diagramFeature => {

      // DIAGRAM ATTRIBUTES //
      const diagramAttributes = diagramFeature.properties || diagramFeature.attributes;

      // ASSIGN NEW GEOPLANNER SCENARIO ID //
      diagramAttributes.Geodesign_ScenarioID = scenarioID;

      // ...WHEN AVAILABLE WE'LL MAINTAIN THE OBJECTID IN SOME OTHER FIELD... //
      //diagramAttributes.SOURCEID = diagramAttributes.OBJECTID;

      // DELETE SYSTEM FIELDS //
      delete diagramAttributes.Shape__Area;
      delete diagramAttributes.Shape__Length;
      // - NEW OBJECTID AND GLOBALID WILL BE ASSIGNED BY FEATURE LAYER WHEN ADDED //
      delete diagramAttributes.OBJECTID;
      delete diagramAttributes.GLOBALID;

      return diagramFeature;
    });

  }

  /**
   *
   * PortalItem: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html
   *
   * @param {Portal} portal
   * @param {PortalItem} sourcePortalItem
   * @param {number} interventionLayerId
   * @returns {Promise<{portalItem: PortalItem, scenarioFilter: string}>}
   */
  _createNewGeoPlannerScenarioPortalItem({portal, sourcePortalItem, interventionLayerId = 0}) {
    return new Promise((resolve, reject) => {
      require(['esri/portal/PortalItem'], (PortalItem) => {

        // GET RPOJECT ID FROM TYPEKEYWORD //
        const projectKeyword = sourcePortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));
        const projectID = projectKeyword.replace(/geodesignProjectID/, '');

        // GET PORTAL ITEM DATA //
        //  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#fetchData
        sourcePortalItem.fetchData().then((sourceLayerPortalItemData) => {
          console.info("SOURCE Scenario Portal Item: ", sourcePortalItem);
          console.info("SOURCE Scenario Portal Item Data: ", sourceLayerPortalItemData);

          //
          // CREATE NEW PORTAL ITEM FOR THE NEW SCENARIO //
          //
          const newPortalItem = new PortalItem({
            title: `${ sourcePortalItem.title } - new scenario [${ (new Date()).valueOf() }]`,
            snippet: `${ sourcePortalItem.snippet } - new scenario`,
            description: `${ sourcePortalItem.description } - new scenario`,
            accessInformation: sourcePortalItem.accessInformation,
            type: sourcePortalItem.type,
            typeKeywords: sourcePortalItem.typeKeywords,
            url: sourcePortalItem.url,
            tags: sourcePortalItem.tags.concat('gdhtest') // APPEND GDHTEST TAG JUST FOR TESTING THIS APP //
          });

          // PORTAL USER //
          // - PortalUser: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html
          const portalUser = portal.user;

          //
          // https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html#addItem
          //
          // ADD NEW PORTAL ITEM FOR THE NEW SCENARIO TO THE PORTAL //
          //  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html#addItem
          portalUser.addItem({
            item: newPortalItem
          }).then(newScenarioPortalItem => {
            console.info("NEW Scenario Portal Item: ", newScenarioPortalItem);

            // SCENARIO ID IS SAME AS THE NEW PORTAL ITEM ID //
            const scenarioID = newScenarioPortalItem.id;
            // QUERY FILTER USED TO GET BACK SCENARIO SPECIFIC FEATURES //
            const scenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ scenarioID }')`;

            //
            // SET NEW LAYER DEFINITION EXPRESSION //
            //
            const updatedLayerPortalItemData = {...sourceLayerPortalItemData};
            updatedLayerPortalItemData.layers[interventionLayerId].layerDefinition = scenarioFilter;
            console.info("UPDATE to Scenario Portal Item Data", updatedLayerPortalItemData);

            // UPDATE ITEM DATA WITH NEW SUBLAYER DEFINITION
            // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#update
            newScenarioPortalItem.update({
              data: updatedLayerPortalItemData
            }).then((updatedScenarioPortalItem) => {
              console.info("UPDATED Scenario Portal Item: ", updatedScenarioPortalItem);

              // VERIFY UPDATED SUBLAYER DEFINITION
              // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#fetchData
              updatedScenarioPortalItem.fetchData().then((updatedLayerPortalItemData) => {
                console.info("UPDATED Scenario Portal Item Data: ", updatedLayerPortalItemData);

                resolve({portalItem: updatedScenarioPortalItem, scenarioFilter});

              }).catch(console.error);
            }).catch(console.error);
          }).catch(console.error);
        }).catch(console.error);

      });
    });
  }

  /**
   *
   * ADD THE CANDIDATE FEATURES TO THE GEOPLANNER PROJECT AS A NEW SCENARIO
   *
   * @param {Graphic[]} candidateFeatures array of features
   * @param {PortalItem} portalItem
   * @param {number} interventionLayerId
   * @returns {Promise<{newScenarioFeatures:Graphic[]}>}
   */
  _addNewGeoPlannerScenarioFeatures(candidateFeatures, portalItem, interventionLayerId = 0) {
    return new Promise((resolve, reject) => {
      require(['esri/request'], (esriRequest) => {

        alert('Need features as Esri JSON...')
        resolve({newScenarioFeatures: []});


        //
        // TODO: CONVERT FROM GEOJSON TO ESRI REST JSON
        //
        /*const _candidateFeatures = candidateFeatures.map(feature => {
          return feature;
        });*/

        //
        //   NOTE: IF USING GDH THEN THE FEATURES SHOULD COME BACK AS ESRI JSON...
        //

        //
        // https://developers.arcgis.com/rest/services-reference/enterprise/apply-edits-feature-service-layer-.htm
        //
        /*const geoPlannerScenarioLayerApplyEditsUrl = `${ portalItem.url }/${ interventionLayerId }/applyEdits`;
        esriRequest(geoPlannerScenarioLayerApplyEditsUrl, {
          query: {
            adds: _candidateFeatures,
            f: 'json'
          },
          method: 'post'
        }).then((response) => {
          console.info(response);
          const editsResults = response.data;

          // LIST OF OBJECTIDS OF NEWLY ADDED FEATURES //
          // - APPLY EDITS RETURNS THE NEW OBJECTIDS OF ADDED FEATURES - OR ERROR IF FAILED //
          const addFeaturesOIDs = editsResults.addFeatureResults.reduce((oids, addFeatureResult) => {
            return addFeatureResult.error ? oids : oids.concat(addFeatureResult.objectId);
          }, []);

          // TODO: NOT NECESSARY BUT WE CAN VERFIFY BY GETTING THE NEWLY ADDED FEATURES...
          resolve({newScenarioFeatures: []});
        });*/

        //
        //
        //
        //
        //
        //
        //
        //

        // ADD THE CANDIDATE FEATURES TO THE FEATURE LAYER //
        /*interventionsLayer.applyEdits({addFeatures: candidateFeatures}).then((editsResults) => {

         // LIST OF OBJECTIDS OF NEWLY ADDED FEATURES //
         // - APPLY EDITS RETURNS THE NEW OBJECTIDS OF ADDED FEATURES - OR ERROR IF FAILED //
         const addFeaturesOIDs = editsResults.addFeatureResults.reduce((oids, addFeatureResult) => {
         return addFeatureResult.error ? oids : oids.concat(addFeatureResult.objectId);
         }, []);

         // QUERY PARAMS TO RETRIEVE THE NEW SCENARIO FEATURES //
         // - RESET WHERE CLAUSE TO IGNORE EXISTING SCENARIO FILTER //
         const scenarioQuery = interventionsLayer.createQuery();
         scenarioQuery.set({
         where: '1=1', // ...reset where clause...  //
         objectIds: addFeaturesOIDs,
         outFields: ['*']
         });
         // RETRIEVE THE NEWLY ADDED FEATURES //
         interventionsLayer.queryFeatures(scenarioQuery).then((scenarioFS) => {
         resolve({newScenarioFeatures: scenarioFS.features});
         });
         });*/
      });
    });
  }

  /**
   *
   * @param portal
   */
  initializeGeoPlannerLayers({portal}) {
    require(['esri/request'], (esriRequest) => {

      const geoplannerSourceItemDetails = document.getElementById('geoplanner-source-item-details');
      const geoplannerTargetItemDetails = document.getElementById('geoplanner-target-item-details');

      const gdhDiagramsList = document.getElementById('gdh-diagrams-list');
      const gdhCandidatesList = document.getElementById('gdh-candidates-list');
      const gdhScenarioList = document.getElementById('gdh-scenario-list');

      const getRandomCandidatesBtn = document.getElementById('get-random-candidates-btn');
      const addCandidatesBtn = document.getElementById('add-candidates-btn');

      /**
       *
       *  project: id, projecttitle, projectdesc
       *  system: id, sysname, syscolor, systag, syscost, sysbudget
       *  diagram: id, worlddescription, author, created_at, rank, sysid
       *
       */

      if (portal) {

        // DISPLAY LIST OF IGC FEATURE LAYER PORTAL ITEMS //
        this._displayPortalItemsList({portal}).then(({layerPortalItems}) => {

          // SELECT FIRST FEATURE LAYER ITEM FOUND //
          // - IDEALLY THE USER COULD PICK FROM THE AVAILABLE SCENARIOS
          const firstLayerPortalItem = layerPortalItems[0];
          //console.info(firstLayerPortalItem);

          // GET RPOJECT ID FROM TYPEKEYWORD //
          const projectIDkeyword = firstLayerPortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));
          const projectID = projectIDkeyword.replace(/geodesignProjectID/, '');

          // SOURCE SCENARIO FILTER //
          const sourceScenarioID = firstLayerPortalItem.id;
          const sourceScenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ sourceScenarioID }')`;
          geoplannerSourceItemDetails.innerHTML = sourceScenarioFilter;

          // INTERVENTION SUBLAYER ID //
          // TODO: ASSUME INTERVENTION LAYER ID IS 0 ????
          const interventionLayerId = 0;

          //
          // GET THE FEATURES AS GEOJSON DIRECTLY FROM THE REST ENDPOINT //
          //  - esri/request IS A GENERIC METHOD TO MAKE DIRECT WEB CALLS BUT WILL HANDLE ESRI SPECIFIC USE-CASES
          //      DOC: https://developers.arcgis.com/javascript/latest/api-reference/esri-request.html
          //  - HERE WE USE IT TO MAKE A DIRECT CALL TO THE QUERY REST ENDPOINT OF THE FEATURE LAYER
          //
          const geoPlannerScenarioLayerQueryUrl = `${ firstLayerPortalItem.url }/${ interventionLayerId }/query`;
          esriRequest(geoPlannerScenarioLayerQueryUrl, {
            query: {
              where: `${ sourceScenarioFilter } AND (Intervention_System <> 'NA')`,
              outFields: '*',
              f: 'geojson'
            }
          }).then((response) => {
            const data = response.data;
            console.info("GeoJSON features via esriRequest(): ", data);

            //
            // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
            //
            const diagramBySystemsGeoJSON = this._displayFeaturesList(gdhDiagramsList, data.features, true);
            console.info("Diagrams by System as GeoJSON: ", diagramBySystemsGeoJSON);

            //
            // CREATE A LIST OF RANDOM CANDIDATE FEATURES //
            //
            let _candidateFeatures;
            getRandomCandidatesBtn.addEventListener('click', () => {
              // CANDIDATE GEOPLANNER SCENARIO FEATURES //
              _candidateFeatures = this._createRandomScenarioCandidates(data.features);
              console.info('Random Candidate Features: ', _candidateFeatures);

              const diagramBySystemsCandidates = this._displayFeaturesList(gdhCandidatesList, _candidateFeatures, true);
              console.info("Diagrams by System for Candidate Features: ", diagramBySystemsCandidates);
            });

            //
            // ADD RANDOM CANDIDATE FEATURED TO THE GEOPLANNER PROJECT AS A NEW SCENARIO //
            //
            addCandidatesBtn.addEventListener('click', () => {
              if (_candidateFeatures && confirm('Add random candidate features as new GeoPlanner Scenario?')) {

                //
                // CREATE TARGET SCENARIO PORTAL ITEM //
                //  - THIS WILL GIVE US THE NECESSARY NEW SCENARIO ID...
                //
                this._createNewGeoPlannerScenarioPortalItem({portal, sourcePortalItem: firstLayerPortalItem, interventionLayerId}).then(({portalItem, scenarioFilter}) => {

                  // NEW SCENARIO ID //
                  const newScenarioID = portalItem.id;

                  // NEW SCENARIO FILTER //
                  geoplannerTargetItemDetails.innerHTML = scenarioFilter;

                  // UPDATE NEW SCENARIO FEATURES //
                  _candidateFeatures = this._updateScenarioCandidates(_candidateFeatures, newScenarioID);

                  // NEW GEOPLANNER SCENARIO //
                  this._addNewGeoPlannerScenarioFeatures(_candidateFeatures, portalItem).then(({newScenarioFeatures}) => {
                    console.info('New GeoPlanner Scenario Features: ', newScenarioFeatures);

                    // const diagramBySystemsScenario = this.displayFeaturesList(gdhScenarioList, newScenarioFeatures);
                    // console.info("Diagrams by System from new GeoPlanner Scenario: ", diagramBySystemsScenario);
                  });
                });
              } else {
                alert('please get random candidates first...');
              }
            });

          });
        });

      }
    });
  }

}

export default new DiagramReader();
