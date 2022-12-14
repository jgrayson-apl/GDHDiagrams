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
    if (DiagramReader.CONFIG.GEODESIGNHUB_TOKEN?.length) {
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
   * @returns {Promise<{geoPlannerGroups:PortalGroup[]}>}
   * @private
   */
  _findGeoPlannerGroups({portal}) {
    return new Promise((resolve, reject) => {

      // FIND GROUP //
      const geoPlannerGroupsList = document.getElementById('geoplanner-groups-list');

      // ASK PORTAL TO FIND GEOPLANNER GROUPS //
      portal.queryGroups({
        query: 'IGC tags:(geodesign AND geodesignProject)',
        sortField: 'modified',
        sortOrder: 'desc',
        num: 100
      }).then(({results}) => {
        console.info(results);

        const groupListItems = results.map(geoPlannerGroup => {
          const groupListItem = document.createElement('div');
          groupListItem.classList.add('geoplanner-list-item');
          groupListItem.innerHTML = geoPlannerGroup.title;

          groupListItem.addEventListener('click', () => {
            geoPlannerGroupsList.querySelector('.geoplanner-list-item.selected')?.classList.remove('selected');
            groupListItem.classList.add('selected');

            this.dispatchEvent(new CustomEvent('portal-group-selected', {detail: {portalGroup: geoPlannerGroup}}));
          });

          return groupListItem;
        });
        geoPlannerGroupsList.replaceChildren(...groupListItems);

        resolve({geoPlannerGroups: results});
      });
    });
  }

  /**
   *
   * @param {PortalUser} portalUser
   * @param geoPlannerProjectID
   * @returns {Promise<{portalFolder: PortalFolder}>}
   * @private
   */
  _findGeoPlannerProjectFolder({portalUser, geoPlannerProjectID}) {
    return new Promise((resolve, reject) => {
      portalUser.fetchFolders().then((userFolders) => {
        const geoPlannerFolder = userFolders.find(folder => folder.title === geoPlannerProjectID);
        resolve({portalFolder: geoPlannerFolder});
      }).catch(reject);
    });
  }

  /**
   *
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalGroup.html
   *
   * @param {PortalGroup} portalGroup
   * @returns {Promise<PortalItem[]>}
   * @private
   */
  _displayPortalItemsList({portalGroup}) {
    return new Promise((resolve, reject) => {

      //
      // TODO: FIND IGC GROUP AND THEN ONLY LIST THE VALID
      //       GEOPLANNER SCENARIOS FEATURELAYER PORTAL ITEMS...
      //

      const portalItemsList = document.getElementById('geoplanner-items-list');

      /**
       * https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalGroup.html#queryItems
       *
       * ASK PORTAL TO RETURN PORTAL ITEMS
       *  - items with these tags: IGC | geodesign | geodesignScenario
       *  - TODO: ONLY APPENDED GDHTEST TAG JUST FOR TESTING THIS APP
       *
       */
      portalGroup.queryItems({
        query: 'tags:(IGC AND geodesign AND geodesignScenario NOT gdhtest)', // TODO: ONLY APPENDED GDHTEST TAG JUST FOR TESTING THIS APP //
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
          layerItemNode.classList.add('geoplanner-list-item');
          layerItemNode.innerHTML = `[${ layerPortalItem.id }] ${ layerPortalItem.title }`;

          layerItemNode.addEventListener('click', () => {
            portalItemsList.querySelector('.geoplanner-list-item.selected')?.classList.remove('selected');
            layerItemNode.classList.add('selected');

            this.dispatchEvent(new CustomEvent('portal-item-selected', {detail: {portalItem: layerPortalItem}}));
          });

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
   * @param {PortalGroup} sourcePortalGroup
   * @param {PortalItem} sourcePortalItem
   * @param {number} interventionLayerId
   * @returns {Promise<{portalItem: PortalItem, scenarioID: string, scenarioFilter: string}>}
   */
  _createNewGeoPlannerScenarioPortalItem({portal, sourcePortalGroup, sourcePortalItem, interventionLayerId = 0}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/request',
        'esri/portal/PortalItem'
      ], (esriRequest, PortalItem) => {

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
            type: sourcePortalItem.type,
            url: sourcePortalItem.url,
            title: `${ sourcePortalItem.title } - GDH Design [${ (new Date()).valueOf() }]`,
            snippet: `${ sourcePortalItem.snippet } - GDH Design`,
            description: `${ sourcePortalItem.description } - GDH Design`,
            accessInformation: sourcePortalItem.accessInformation,
            typeKeywords: sourcePortalItem.typeKeywords,
            tags: sourcePortalItem.tags.concat('gdhtest') // APPEND GDHTEST TAG JUST FOR TESTING THIS APP //
          });

          // PORTAL USER //
          // - PortalUser: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html
          const portalUser = portal.user;

          // FIND GEOPLANNER PROJECT FOLDER //
          this._findGeoPlannerProjectFolder({portalUser, geoPlannerProjectID: projectKeyword}).then(({portalFolder}) => {

            // ADD ITEM PROPERTIES //
            const addItemProps = {item: newPortalItem};
            // IF USER HAS A MATCHING GEOPLANNER PROJECT FOLDER //
            portalFolder && (addItemProps.folder = portalFolder.id);

            //
            // ADD NEW PORTAL ITEM FOR THE NEW SCENARIO TO THE PORTAL //
            //  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html#addItem
            //
            portalUser.addItem(addItemProps).then(newScenarioPortalItem => {
              console.info("NEW Scenario Portal Item: ", newScenarioPortalItem);

              // SCENARIO ID IS SAME AS THE NEW PORTAL ITEM ID //
              const scenarioID = newScenarioPortalItem.id;
              // QUERY FILTER USED TO GET BACK SCENARIO SPECIFIC FEATURES //
              const scenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ scenarioID }')`;

              //
              // SET NEW LAYER DEFINITION EXPRESSION //
              //
              const updatedLayerPortalItemData = {...sourceLayerPortalItemData};
              updatedLayerPortalItemData.layers[interventionLayerId].layerDefinition = {
                definitionExpression: scenarioFilter
              };
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

                  //
                  // UPDATING PORTAL ITEM SHARING
                  //
                  // https://developers.arcgis.com/rest/users-groups-and-items/share-item-as-item-owner-.htm
                  //

                  const portalItemShareUrl = `${ updatedScenarioPortalItem.userItemUrl }/share`;
                  esriRequest(portalItemShareUrl, {
                    query: {
                      everyone: false,
                      org: true,
                      groups: sourcePortalGroup.id,
                      f: 'json'
                    },
                    method: 'post'
                  }).then((response) => {

                    resolve({portalItem: updatedScenarioPortalItem, scenarioID, scenarioFilter});

                  }).catch(console.error);
                }).catch(console.error);
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

        //
        //   NOTE: IF USING GDH THEN THE FEATURES SHOULD COME BACK AS ESRI JSON
        //         AND THIS CONVERSION IS ***NOT*** NEEDED...
        //
        const scenarioFeatures = candidateFeatures.map(feature => {
          return {
            attributes: {...feature.properties},
            geometry: Terraformer.geojsonToArcGIS(feature.geometry)
          };
        });
        //console.info(scenarioFeatures);

        //
        // https://developers.arcgis.com/rest/services-reference/enterprise/apply-edits-feature-service-layer-.htm
        //
        const geoPlannerScenarioLayerApplyEditsUrl = `${ portalItem.url }/${ interventionLayerId }/applyEdits`;
        esriRequest(geoPlannerScenarioLayerApplyEditsUrl, {
          query: {
            adds: JSON.stringify(scenarioFeatures),
            f: 'json'
          },
          method: 'post'
        }).then((response) => {

          // RESULTS OF ADDING NEW FEATURES //
          const {addResults} = response.data;

          // LIST OF OBJECTIDS OF NEWLY ADDED FEATURES //
          // - APPLY EDITS RETURNS THE NEW OBJECTIDS OF ADDED FEATURES - OR ERROR IF FAILED //
          const addFeaturesOIDs = addResults.reduce((oids, addFeatureResult) => {
            return addFeatureResult.error ? oids : oids.concat(addFeatureResult.objectId);
          }, []);
          console.info(`Add Feature Results (${ addFeaturesOIDs.length } of ${ scenarioFeatures.length }): `, addFeaturesOIDs);

          resolve({addFeaturesOIDs});
        }).catch(reject);
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

        // INTERVENTION SUBLAYER ID //
        // TODO: ASSUME INTERVENTION LAYER ID IS 0 ????
        const interventionLayerId = 0;

        let _geoPlannerSourceGroup;
        let _geoPlannerSourcePortalItem;
        let _geoPlannerSourceScenarioFeatures;
        let _candidateFeatures;

        // FIND GEOPLANNER GROUPS //
        this._findGeoPlannerGroups({portal}).then(({geoPlannerGroups}) => {
          console.info("GeoPlanner Groups: ", geoPlannerGroups);

          //
          // WHEN PORTAL GROUP IS SELECTED //
          //
          this.addEventListener('portal-group-selected', ({detail: {portalGroup}}) => {
            // SOURCE GROUP //
            _geoPlannerSourceGroup = portalGroup;
            // DISPLAY LIST OF IGC FEATURE LAYER PORTAL ITEMS //
            this._displayPortalItemsList({portalGroup}).then();
          });

          //
          // WHEN PORTAL ITEM IS SELECTED //
          //
          this.addEventListener('portal-item-selected', ({detail: {portalItem}}) => {
            // SOURCE PORTAL ITEM //
            _geoPlannerSourcePortalItem = portalItem;

            // GET RPOJECT ID FROM TYPEKEYWORD //
            const projectIDkeyword = _geoPlannerSourcePortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));
            const projectID = projectIDkeyword.replace(/geodesignProjectID/, '');

            // SOURCE SCENARIO FILTER //
            const sourceScenarioID = _geoPlannerSourcePortalItem.id;
            const sourceScenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ sourceScenarioID }')`;
            geoplannerSourceItemDetails.innerHTML = sourceScenarioFilter;

            //
            // GET THE FEATURES AS GEOJSON DIRECTLY FROM THE REST ENDPOINT //
            //  - esri/request IS A GENERIC METHOD TO MAKE DIRECT WEB CALLS BUT WILL HANDLE ESRI SPECIFIC USE-CASES
            //      DOC: https://developers.arcgis.com/javascript/latest/api-reference/esri-request.html
            //  - HERE WE USE IT TO MAKE A DIRECT CALL TO THE QUERY REST ENDPOINT OF THE FEATURE LAYER
            //
            const geoPlannerScenarioLayerQueryUrl = `${ _geoPlannerSourcePortalItem.url }/${ interventionLayerId }/query`;
            esriRequest(geoPlannerScenarioLayerQueryUrl, {
              query: {
                where: `${ sourceScenarioFilter } AND (Intervention_System <> 'NA')`,
                outFields: '*',
                f: 'geojson'
              }
            }).then((response) => {
              const {features} = response.data;
              console.info("GeoJSON features via esriRequest(): ", features);

              // GEOPLANNER SOURCE SCENARIO FEATURES //
              _geoPlannerSourceScenarioFeatures = features;

              //
              // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
              //
              const diagramBySystemsGeoJSON = this._displayFeaturesList(gdhDiagramsList, _geoPlannerSourceScenarioFeatures, true);
              console.info("Diagrams by System as GeoJSON: ", diagramBySystemsGeoJSON);

            });
          });

          //
          // CREATE A LIST OF RANDOM CANDIDATE FEATURES //
          //

          getRandomCandidatesBtn.addEventListener('click', () => {
            if (_geoPlannerSourceScenarioFeatures) {
              // CANDIDATE GEOPLANNER SCENARIO FEATURES //
              _candidateFeatures = this._createRandomScenarioCandidates(_geoPlannerSourceScenarioFeatures);
              console.info('Random Candidate Features: ', _candidateFeatures);

              const diagramBySystemsCandidates = this._displayFeaturesList(gdhCandidatesList, _candidateFeatures, true);
              console.info("Diagrams by System for Candidate Features: ", diagramBySystemsCandidates);
            } else {
              alert('No Scenario Portal Item selected...');
            }
          });

          //
          // ADD RANDOM CANDIDATE FEATURED TO THE GEOPLANNER PROJECT AS A NEW SCENARIO //
          //
          addCandidatesBtn.addEventListener('click', () => {
            if (_candidateFeatures) {

              //
              // CREATE TARGET SCENARIO PORTAL ITEM //
              //  - THIS WILL GIVE US THE NECESSARY NEW SCENARIO ID...
              //
              this._createNewGeoPlannerScenarioPortalItem({
                portal,
                sourcePortalGroup: _geoPlannerSourceGroup,
                sourcePortalItem: _geoPlannerSourcePortalItem,
                interventionLayerId
              }).then(({portalItem, scenarioID, scenarioFilter}) => {

                // NEW SCENARIO FILTER //
                geoplannerTargetItemDetails.innerHTML = scenarioFilter;

                //
                // HERE WE WOULD CALL GDH TO PROVIDE A NEGOTIATED SET OF DIAGRAMS/FEATURES //
                //

                // UPDATE NEW SCENARIO FEATURES //
                _candidateFeatures = this._updateScenarioCandidates(_candidateFeatures, scenarioID);

                // NEW GEOPLANNER SCENARIO //
                this._addNewGeoPlannerScenarioFeatures(_candidateFeatures, portalItem).then(({addFeaturesOIDs}) => {
                  console.info('New GeoPlanner Scenario Features: ', addFeaturesOIDs);

                  // DISPLAY LIST OF NEW SCENARIO FEATURE OIDS //
                  gdhScenarioList.innerHTML = addFeaturesOIDs.map(oid => `OID: ${ oid }`).join('<br>');

                });
              });
            } else {
              alert('please get random candidates first...');
            }
          });
        });

      }
    });
  }

}

export default new DiagramReader();
