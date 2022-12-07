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
    OAUTH_APP_ID: "PZdAgiu187TroTCX"
  };

  /**
   *
   */
  constructor() {
    super();

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
   * @param portal
   */
  initializeGeoPlannerLayers({portal}) {
    require([
      'esri/config',
      'esri/request',
      'esri/layers/Layer',
      'esri/symbols/support/symbolUtils'
    ], (esriConfig, esriRequest, Layer, symbolUtils) => {

      const geoplannerItemsList = document.getElementById('geoplanner-items-list');
      const geoplannerItemLabel = document.getElementById('geoplanner-item-label');
      const geoplannerItemDetails = document.getElementById('geoplanner-item-details');
      const gdhFeaturesList = document.getElementById('gdh-features-list');
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

        //
        // ASK PORTAL TO RETURN PORTAL ITEMS
        //  - items with these tags: IGC | geodesign | geodesignScenario
        //  - for testing only: owner:csmith_IGCollab
        //
        portal.queryItems({
          query: 'tags:(IGC AND geodesign AND geodesignScenario)', // AND owner:csmith_IGCollab
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
          geoplannerItemsList.replaceChildren(...layerItemNodes);

          // SELECT FIRST FEATURE LAYER ITEM FOUND //
          // - IDEALLY THE USER COULD PICK FROM THE AVAILABLE PLANS... MAYBE... ???
          const firstLayerPortalItem = layerPortalItems[0];

          // GET THE LAYER FROM THE PORTAL ITEM //
          // - THIS WILL INSTANTIATE A FEATURE LAYER BASED ON THE PORTAL ITEM
          Layer.fromPortalItem(firstLayerPortalItem).then((layer) => {
            // THE GEOPLANNER LAYER ITEM REFERENCES A FEATURE LAYER WITH MULTIPLE SUBLAYERS
            // SO WE GET BACK A GROUP LAYER WITH TWO FEATURE LAYERS
            // AND WE THEN MAKE SURE ALL SUB LAYERS ARE LOADED...
            layer.loadAll().then(() => {

              // INTERVENTIONS LAYER //
              //  - hardocded to find a layer with a title that includes 'interventions'...
              //  - TODO: FIND BETTER WAY TO HANDLE THIS...
              const interventionsLayer = layer.layers.find(l => l.title.toLowerCase().includes('interventions'));

              // DISPLAY NAME OF GEOPLANNER DESIGN LAYER //
              geoplannerItemLabel.innerHTML = interventionsLayer.title;
              // DISPLAY FILTER USED OF THE GEOPLANNER DESIGN LAYER //
              // - THIS WILL SHOW THE DEFAULT QUERY USED FOR THIS LAYER
              //   AND SHOWS THE ID OF THE GEOPLANNER PROJECT AND DESIGN
              geoplannerItemDetails.innerHTML = interventionsLayer.definitionExpression;

              //
              //  IMPORTANT: createQuery() WILL USE THE LAYER DEFINITION EXPRESSION WHICH PROVIDES A SCENARIO SPECIFIC FILTER
              //    - WE WANT THE GEOMETRY AND ALL THE FIELDS SO WE CAN REPLICATE THEM WHEN ADDING AS NEW DESIGN/PLAN...
              //
              const analysisQuery = interventionsLayer.createQuery();

              // DIAGRAMS FILTER //
              //  - IN ADDITION TO THE DEFAULT FILTER WE ALSO IGNORE ANY FEATURE WITHOUT AN INTERVENTION
              //  - NOTE: ALSO USED WHEN RETRIEVING THE GEOJSON FEATURES...
              const diagramsFilter = `${ analysisQuery.where } AND (Intervention_System <> 'NA')`;  // TODO: REPLACE 'NA' WITH NULL VALUES?

              // SET ANALYSIS QUERY PARAMETERS //
              //  - UPDATE THE WHERE CLAUSE TO ONLY INCLUDE FEATURES WITH AN INTERVENTION
              analysisQuery.set({
                where: diagramsFilter,
                outFields: ['*'],
                returnGeometry: true
              });

              // GET DIAGRAM COLOR BASED ON CURRENT RENDERER //
              const _getDiagramColor = ({diagramAttributes}) => {
                return new Promise((resolve, reject) => {
                  symbolUtils.getDisplayedColor({attributes: diagramAttributes}, {renderer: interventionsLayer.renderer}).then((color) => {
                    resolve({color});
                  });
                });
              };

              // UI - DISPLAY LIST OF FEATURES //
              const _displayFeaturesList = (container, features, isGeoJSON) => {

                const diagramBySystems = new Map();

                const diagramItems = features.map(diagramFeature => {

                  // DIAGRAM ATTRIBUTES //
                  const diagramAttributes = isGeoJSON ? diagramFeature.properties : diagramFeature.attributes;

                  // RELEVANT FEATURE/DIAGRAM PROPERTIES //
                  const {
                    OBJECTID,
                    Geodesign_ProjectID,
                    Geodesign_ScenarioID,
                    Intervention_System,
                    Intervention_Type
                  } = diagramAttributes;

                  // FEATURE/DIAGRAM ITEM //
                  const diagramItem = document.createElement('div');
                  diagramItem.classList.add('diagram-item');
                  diagramItem.innerHTML = `[ ${ OBJECTID } ] ${ Intervention_System } | ${ Intervention_Type }`;
                  diagramItem.title = JSON.stringify(diagramFeature, null, 2);

                  const isMultiPartGeometry = isGeoJSON ? (diagramFeature.geometry.coordinates.length > 1) : (diagramFeature.geometry.rings.length > 1);
                  isMultiPartGeometry && diagramItem.classList.add('multipart');

                  // GET COLOR USED IN GEOPLANNER FOR THIS FEATURE //
                  _getDiagramColor({diagramAttributes: diagramAttributes}).then(({color}) => {
                    diagramItem.style.borderLeftColor = color.toCss();
                  });

                  // ORGANIZE FEATURES/DIAGRAMS BY SYSTEM //
                  const diagramBySystem = diagramBySystems.get(Intervention_System) || [];
                  diagramBySystem.push(diagramFeature);
                  diagramBySystems.set(Intervention_System, diagramBySystem);

                  return diagramItem;
                });
                // ADD DIAGRAMS TO LIST //
                container.replaceChildren(...diagramItems);

                return diagramBySystems;
              };

              //
              //
              // BELOW WE RETRIEVE THE FEATURES FROM THE SERVICE
              // - AS GEOJSON
              // - AS ESRI FEATURES
              //
              // AND THEN WE CREATE A RANDOM SUBSET OF FEATURES
              // AND THEN ADD THEM AS A NEW GEOPLANNER SCENARIO
              //
              //

              //
              // GET THE FEATURES AS GEOJSON DIRECTLY FROM THE REST ENDPOINT //
              //  - esri/request IS A GENERIC METHOD TO MAKE DIRECT WEB CALLS BUT WILL HANDLE ESRI SPECIFIC USE-CASES
              //  - HERE WE USE IT TO MAKE A DIRECT CALL TO THE REST QUERY ENDPOINT OF THE FEATURE LAYER
              //
              const directQueryUrl = `${ interventionsLayer.url }/${ interventionsLayer.layerId }/query`;
              esriRequest(directQueryUrl, {
                query: {
                  where: diagramsFilter,
                  outFields: '*',
                  f: 'geojson'
                },
                responseType: "json"
              }).then((response) => {
                const data = response.data;
                console.info("GeoJSON features via esriRequest(): ", data);

                //
                // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
                //
                const diagramBySystemsGeoJSON = _displayFeaturesList(gdhDiagramsList, data.features, true);
                console.info("Diagrams by System as GeoJSON: ", diagramBySystemsGeoJSON);
              });

              //
              // GET THE FEATURES FROM THE FEATURE LAYER //
              // BREAK DOWN THE LIST OF FEATURES BY SYSTEM TO PRODUCE A LIST OF DIAGRAMS
              //
              interventionsLayer.queryFeatures(analysisQuery).then(analysisFS => {
                console.info("Esri JSON features via queryFeatures(): ", analysisFS);

                //
                // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
                //
                const diagramBySystems = _displayFeaturesList(gdhFeaturesList, analysisFS.features);
                console.info("Diagrams by System as Esri JSON: ", diagramBySystems);

                // CREATE A LIST OF RANDOM CANDIDATE FEATURES //
                let _candidateFeatures;
                getRandomCandidatesBtn.addEventListener('click', () => {
                  // CANDIDATE GEOPLANNER SCENARIO FEATURES //
                  _candidateFeatures = createNewGeoPlannerScenarioCandidates(analysisFS.features);

                  const diagramBySystemsCandidates = _displayFeaturesList(gdhCandidatesList, _candidateFeatures);
                  console.info("Diagrams by System for Candidate Features: ", diagramBySystemsCandidates);

                  console.info('Random Candidate Features: ', _candidateFeatures);
                });

                // ADD RANDOM CANDIDATE FEATURED TO THE GEOPLANNER PROJECT AS A NEW SCENARIO //
                addCandidatesBtn.addEventListener('click', () => {
                  if (_candidateFeatures) {
                    // NEW GEOPLANNER SCENARIO //
                    addNewGeoPlannerScenario(_candidateFeatures).then(({newScenarioFeatures}) => {
                      console.info('New GeoPlanner Scenario Features: ', newScenarioFeatures);
                      const diagramBySystemsScenario = _displayFeaturesList(gdhScenarioList, newScenarioFeatures);
                      console.info("Diagrams by System from new GeoPlanner Scenario: ", diagramBySystemsScenario);
                    });
                  } else {
                    alert('please get random candidates first...');
                  }
                });

              });

              /**
               * based on: https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid
               *
               * @returns {string}
               */
              function _uuid() {
                const url = URL.createObjectURL(new Blob());
                const [id] = url.toString().split('/').reverse();
                URL.revokeObjectURL(url);
                return id.replace(/-/g, '');
              }

              /**
               *
               * CREATE A RANDOM SELECTION OF CANDIDATE FEATURES
               *  - SIMILAR AS A SET OF GDH NEGOTIATED DIAGRAMS BECOMES A NEW DESIGN...
               *
               * @param features
               * @returns {*[]}
               */
              const createNewGeoPlannerScenarioCandidates = (features) => {

                // GET RANDOM CANDIDATE FEATURES //
                const randomCount = 22;
                const sourceFeatures = [...features];
                const candidateFeatures = [];
                do {
                  const candidateIdx = Math.floor(Math.random() * sourceFeatures.length);
                  const candidateFeature = sourceFeatures.splice(candidateIdx, 1)[0];
                  candidateFeatures.push(candidateFeature);
                } while (candidateFeatures.length < randomCount);

                // CREATE NEW SCENARIO ID //
                const newGeoPlannerScenarioID = _uuid();

                // CREATE AN ITEM FOR EACH FEATURE/DIAGRAM //
                return candidateFeatures.map(diagramFeature => {

                  // DIAGRAM ATTRIBUTES //
                  const diagramAttributes = diagramFeature.attributes;

                  // ASSIGN NEW GEOPLANNER SCENARIO ID //
                  diagramAttributes.Geodesign_ScenarioID = newGeoPlannerScenarioID;

                  // ...WHEN AVAILABLE WE'LL MAINTAIN THE OBJECTID IN SOME FIELD... //
                  //diagramAttributes.SOURCEID = diagramAttributes.OBJECTID;

                  // DELETE SYSTEM FIELDS //
                  delete diagramAttributes.Shape__Area;
                  delete diagramAttributes.Shape__Length;
                  // - NEW OBJECTID AND GLOBALID WILL BE ASSIGNED BY FEATURE LAYER WHEN ADDED //
                  delete diagramAttributes.OBJECTID;
                  delete diagramAttributes.GLOBALID;

                  return diagramFeature;
                });

              };

              /**
               *
               * ADD THE CANDIDATE FEATURES TO THE GEOPLANNER PROJECT AS A NEW SCENARIO
               *
               * @param candidateFeatures
               * @returns {Promise<unknown>}
               */
              const addNewGeoPlannerScenario = (candidateFeatures) => {
                return new Promise((resolve, reject) => {
                  // ADD THE CANDIDATE FEATURES TO THE FEATURE LAYER //
                  interventionsLayer.applyEdits({addFeatures: candidateFeatures}).then((editsResults) => {

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
                  });
                });
              };

            });
          });
        });

      } else {
        geoplannerItemsList.replaceChildren();
      }

    });
  }

}

export default new DiagramReader();
