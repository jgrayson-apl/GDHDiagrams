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

import DiagramReaderUI from './DiagramReaderUI.js';

class DiagramReader extends EventTarget {

  static CONFIG = {
    PORTAL_URL: "https://www.arcgis.com",
    OAUTH_APP_ID: "ScgcXXJeR4NDyitK"
  };

  /**
   * @type {DiagramReaderUI}
   */
  diagramReaderUI;

  /**
   * @type {Portal}
   *  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-Portal.html
   *
   */
  portal;

  /**
   * @type {PortalGroup}
   *  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalGroup.html
   *
   * GeoPlanner Project Online Portal Group
   */
  sourcePortalGroup;

  /**
   * @type {PortalItem}
   *  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html
   *
   * GeoPlanner source Scenario FeatureLayer Portal Item
   */
  sourcePortalItem;

  /**
   * @type {number}
   *
   * INTERVENTION SUBLAYER ID
   */
  interventionLayerId = 0;

  /**
   * @type {{}[]} source GeoPlanner Scenario as array of GeoJSON features
   *
   */
  sourceScenarioFeaturesGeoJSON;

  /**
   *
   */
  constructor() {
    super();

    this.diagramReaderUI = new DiagramReaderUI();

  }

  /**
   * INITIALIZE OAUTH AND ACCESS PORTAL
   *
   * @returns {Promise<{portal:Portal}>}
   */
  signIn() {
    return new Promise((resolve, reject) => {
      require(['esri/request'], (esriRequest) => {

        //
        // AUTHENTICATE AND INITIALIZE PORTAL //
        //
        this.authenticateArcGISOnline().then(({portal}) => {

          // PORTAL //
          this.portal = portal;

          // UI STUFF //
          this.diagramReaderUI.portalUser = this.portal.user;

          //
          // FIND GEOPLANNER GROUPS //
          //
          this._findGeoPlannerGroups({portal}).then(() => {

            //
            // WHEN PORTAL GROUP IS SELECTED //
            // UI STUFF //
            //
            this.diagramReaderUI.addEventListener('portal-group-selected', ({detail: {portalGroup}}) => {
              // SOURCE GROUP //
              this.sourcePortalGroup = portalGroup;
              // GET LIST OF IGC FEATURE LAYER PORTAL ITEMS //
              this._getPortalItemsList({portalGroup}).then();
            });

            //
            // WHEN PORTAL ITEM IS SELECTED //
            // UI STUFF //
            //
            this.diagramReaderUI.addEventListener('portal-item-selected', ({detail: {portalItem}}) => {
              // SOURCE PORTAL ITEM //
              this.sourcePortalItem = portalItem;

              // GET RPOJECT ID FROM TYPEKEYWORD //
              const projectIDkeyword = this.sourcePortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));
              const projectID = projectIDkeyword.replace(/geodesignProjectID/, '');

              // SOURCE SCENARIO FILTER //
              const sourceScenarioID = this.sourcePortalItem.id;
              const sourceScenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ sourceScenarioID }')`;
              console.info("Source Scenario Filter: ", sourceScenarioFilter);

              //
              // GET THE FEATURES AS GEOJSON DIRECTLY FROM THE REST ENDPOINT //
              //  - esri/request IS A GENERIC METHOD TO MAKE DIRECT WEB CALLS BUT WILL HANDLE ESRI SPECIFIC USE-CASES
              //      DOC: https://developers.arcgis.com/javascript/latest/api-reference/esri-request.html
              //  - HERE WE USE IT TO MAKE A DIRECT CALL TO THE QUERY REST ENDPOINT OF THE FEATURE LAYER
              //
              const geoPlannerScenarioLayerQueryUrl = `${ this.sourcePortalItem.url }/${ this.interventionLayerId }/query`;
              esriRequest(geoPlannerScenarioLayerQueryUrl, {
                query: {
                  where: `${ sourceScenarioFilter } AND (Intervention_System <> 'NA')`,
                  outFields: '*',
                  f: 'geojson'
                }
              }).then((response) => {
                const {features} = response.data;
                //console.info("GeoJSON features via esriRequest(): ", features);

                // GEOPLANNER SOURCE SCENARIO FEATURES //
                this.sourceScenarioFeaturesGeoJSON = features;

                //
                // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
                //
                const diagramBySystemsGeoJSON = this.diagramReaderUI.displayFeaturesList(this.sourceScenarioFeaturesGeoJSON);


                this.dispatchEvent(new CustomEvent('geoplanner-features', {detail: {sourceScenarioFeaturesGeoJSON: this.sourceScenarioFeaturesGeoJSON}}));

              });
            });

            resolve({portal});
          }).catch(reject);
        }).catch(reject);
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
  authenticateArcGISOnline() {
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

      // ASK PORTAL TO FIND GEOPLANNER GROUPS //
      portal.queryGroups({
        query: 'title:IGC tags:(geodesign AND geodesignProject)',
        sortField: 'modified',
        sortOrder: 'desc',
        num: 100
      }).then(({results}) => {
        //console.info(results);

        this.diagramReaderUI.geoPlannerProjectGroups = results;

        resolve({geoPlannerGroups: results});
      }).catch(reject);
    });
  }

  /**
   *
   *
   * @param {PortalUser} portalUser
   * @param {string} geoPlannerProjectID
   * @returns {Promise<{portalFolder: PortalFolder}>}
   * @private
   */
  _findGeoPlannerProjectFolder({portalUser, geoPlannerProjectID}) {
    return new Promise((resolve, reject) => {
      portalUser.fetchFolders().then((userFolders) => {

        const geoPlannerFolderName = `_ Geoplanner ${ geoPlannerProjectID }`;
        const geoPlannerFolder = userFolders.find(folder => folder.title === geoPlannerFolderName);

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
  _getPortalItemsList({portalGroup}) {
    return new Promise((resolve, reject) => {

      /**
       * https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalGroup.html#queryItems
       *
       * ASK PORTAL TO RETURN PORTAL ITEMS
       *  - items with these tags: IGC | geodesign | geodesignScenario
       *
       */
      portalGroup.queryItems({
        query: 'tags:(geodesign AND geodesignScenario)',
        sortField: 'modified',
        sortOrder: 'desc',
        num: 100
      }).then(({results}) => {

        // LAYER PORTAL ITEMS //
        // - A PORTAL ITEM REPRESENTS THE SIMPLE METADATA ABOUT A GIS THING (MAP, LAYER, ETC...)
        //   AND IN THIS CASE WE'RE JUST INTERESTED IN THE FEATURE LAYERS...
        const layerPortalItems = results.filter(item => item.isLayer);

        this.diagramReaderUI.geoPlannerProjectGroupItems = layerPortalItems;

        resolve({layerPortalItems});
      }).catch(reject);
    });
  }


  /**
   *
   * @param {Graphic[]} designFeaturesAsEsriJSON
   * @returns {Promise<{newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs}>}
   */
  createNewGeoPlannerScenario({designFeaturesAsEsriJSON}) {
    return new Promise((resolve, reject) => {

      //
      // CREATE TARGET SCENARIO PORTAL ITEM //
      //  - THIS WILL GIVE US THE NECESSARY NEW SCENARIO ID...
      //
      this._createNewGeoPlannerScenarioPortalItem().then(({newPortalItem, scenarioID, scenarioFilter}) => {

        // UPDATE NEW SCENARIO FEATURES //
        //
        // - TODO: THESE MODIFICATIONS WILL HAVE TO HAPPEN AND WILL CHANGE AS WE MOVE THE PROJECT FORWARD...
        //
        const updatedDesignFeaturesAsEsriJSON = this._updateScenarioCandidates(designFeaturesAsEsriJSON, scenarioID);

        // ADD NEW GEOPLANNER SCENARIO FEATURES //
        this._addNewGeoPlannerScenarioFeatures({designFeaturesAsEsriJSON: updatedDesignFeaturesAsEsriJSON, newPortalItem}).then(({addFeaturesOIDs}) => {
          //console.info('New GeoPlanner Scenario Features: ', addFeaturesOIDs);

          resolve({newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs});
        }).catch(reject);
      }).catch(reject);
    });
  }

  /**
   *
   * PortalItem: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html
   *
   * @returns {Promise<{newPortalItem: PortalItem, scenarioID: string, scenarioFilter: string}>}
   */
  _createNewGeoPlannerScenarioPortalItem() {
    return new Promise((resolve, reject) => {
      require([
        'esri/request',
        'esri/portal/PortalItem'
      ], (esriRequest, PortalItem) => {

        // GET RPOJECT ID FROM TYPEKEYWORD //
        const projectKeyword = this.sourcePortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));
        const projectID = projectKeyword.replace(/geodesignProjectID/, '');

        // GET PORTAL ITEM DATA //
        //  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#fetchData
        this.sourcePortalItem.fetchData().then((sourceLayerPortalItemData) => {
          //console.info("SOURCE Scenario Portal Item: ", this.sourcePortalItem);
          //console.info("SOURCE Scenario Portal Item Data: ", sourceLayerPortalItemData);

          //
          // CREATE NEW PORTAL ITEM FOR THE NEW SCENARIO //
          //
          // SUGGESTION: USE NEW DESIGN NAME AS THE PORTAL ITEM TITLE BELOW
          //             ALSO, WE CAN USE THE DESCRIPTION TO ADD ANY OTHER
          //             DESIGN RELATED METADATA IN THE DESCRIPTION
          //
          const newPortalItem = new PortalItem({
            type: this.sourcePortalItem.type,
            url: this.sourcePortalItem.url,
            title: `${ this.sourcePortalItem.title } - GDH Design [${ (new Date()).valueOf() }]`,
            snippet: `${ this.sourcePortalItem.snippet } - GDH Design`,
            description: `${ this.sourcePortalItem.description } - GDH Design`,
            accessInformation: this.sourcePortalItem.accessInformation,
            typeKeywords: this.sourcePortalItem.typeKeywords, // THE PROJECT ID WILL BE IN ONE OF THE TYPEKEYWORDS
            tags: this.sourcePortalItem.tags.concat('GDH')    // ADD GDH TAG TO IDENTIFY WHICH SCENARIOS CAME FROM GDH
          });

          // PORTAL USER //
          // - PortalUser: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html
          const portalUser = this.portal.user;

          // FIND GEOPLANNER PROJECT FOLDER //
          this._findGeoPlannerProjectFolder({portalUser, geoPlannerProjectID: projectID}).then(({portalFolder}) => {

            // ADD ITEM PROPERTIES //
            const addItemProps = {item: newPortalItem};
            // IF USER HAS A MATCHING GEOPLANNER PROJECT FOLDER //
            portalFolder && (addItemProps.folder = portalFolder.id);

            //
            // ADD NEW PORTAL ITEM FOR THE NEW SCENARIO TO THE PORTAL //
            //  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html#addItem
            //
            portalUser.addItem(addItemProps).then(newScenarioPortalItem => {
              //console.info("NEW Scenario Portal Item: ", newScenarioPortalItem);

              // SCENARIO ID IS SAME AS THE NEW PORTAL ITEM ID //
              const scenarioID = newScenarioPortalItem.id;
              // QUERY FILTER USED TO GET BACK SCENARIO SPECIFIC FEATURES //
              const scenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ scenarioID }')`;

              //
              // SET NEW LAYER DEFINITION EXPRESSION //
              //
              const updatedLayerPortalItemData = {...sourceLayerPortalItemData};
              updatedLayerPortalItemData.layers[this.interventionLayerId].layerDefinition = {
                definitionExpression: scenarioFilter
              };
              //console.info("UPDATE to Scenario Portal Item Data", updatedLayerPortalItemData);

              // UPDATE ITEM DATA WITH NEW SUBLAYER DEFINITION
              // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#update
              newScenarioPortalItem.update({
                data: updatedLayerPortalItemData
              }).then((updatedScenarioPortalItem) => {
                //console.info("UPDATED Scenario Portal Item: ", updatedScenarioPortalItem);

                // VERIFY UPDATED SUBLAYER DEFINITION
                // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#fetchData
                updatedScenarioPortalItem.fetchData().then((updatedLayerPortalItemData) => {
                  //console.info("UPDATED Scenario Portal Item Data: ", updatedLayerPortalItemData);

                  //
                  // UPDATING PORTAL ITEM SHARING
                  //
                  // https://developers.arcgis.com/rest/users-groups-and-items/share-item-as-item-owner-.htm
                  //
                  const portalItemShareUrl = `${ updatedScenarioPortalItem.userItemUrl }/share`;
                  esriRequest(portalItemShareUrl, {
                    query: {
                      everyone: false,
                      org: false,
                      groups: this.sourcePortalGroup.id,
                      f: 'json'
                    },
                    method: 'post'
                  }).then((response) => {

                    resolve({newPortalItem: updatedScenarioPortalItem, scenarioID, scenarioFilter});

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
   * THESE ARE UPDATES THAT WILL HAVE TO BE MADE TO ALL SCENARIO FEATURES BEFORE
   * ADDING THEM BACK TO THE FEATURE LAYER
   *
   *
   * @param {{}[]} candidateFeatures array of features (GeoJSON or Esri JSON)
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
   * ADD THE CANDIDATE FEATURES TO THE GEOPLANNER PROJECT AS A NEW SCENARIO
   *
   * @param {Graphic[]} designFeaturesAsEsriJSON array of features as Esri JSON
   * @param {PortalItem} newPortalItem
   * @returns {Promise<{addFeaturesOIDs:number[]}>}
   */
  _addNewGeoPlannerScenarioFeatures({designFeaturesAsEsriJSON, newPortalItem}) {
    return new Promise((resolve, reject) => {
      require(['esri/request'], (esriRequest) => {

        //
        // https://developers.arcgis.com/rest/services-reference/enterprise/apply-edits-feature-service-layer-.htm
        //
        const geoPlannerScenarioLayerApplyEditsUrl = `${ newPortalItem.url }/${ this.interventionLayerId }/applyEdits`;
        esriRequest(geoPlannerScenarioLayerApplyEditsUrl, {
          query: {
            adds: JSON.stringify(designFeaturesAsEsriJSON),
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

          resolve({addFeaturesOIDs});
        }).catch(reject);
      });
    });
  }

}

export default DiagramReader;
