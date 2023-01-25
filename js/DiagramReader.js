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

  /**
   *
   * NOTE: HERE WE CAN MAINTAIN BOTH APP IDS AND WE CAN
   *       SWITCH LOCALLY WHILE TESTING...
   *
   * @type {{OAUTH_APP_ID: string, PORTAL_URL: string}}
   */
  static CONFIG = {
    PORTAL_URL: "https://www.arcgis.com/",
    // OAUTH_APP_ID: "L7TzVXFYcEkBe7qz"  // HB //
    OAUTH_APP_ID: "PZdAgiu187TroTCX"    // JG //
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
            // Query (Feature Service/Layer)
            //
            // https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer-.htm
            //

            /**
             *
             * GET MAXIMUM NUMBER OF FEATURES THAT MATCH OUR QUERY FILTER
             *
             * @param {string} queryUrl
             * @param {string} queryFilter
             * @returns {Promise<{maxFeatureCount:number}>}
             * @private
             */
            const _getFeatureCount = ({queryUrl, queryFilter}) => {
              return new Promise((resolve, reject) => {
                esriRequest(queryUrl, {
                  query: {
                    returnCountOnly: true,
                    where: queryFilter,
                    f: 'json'
                  }
                }).then(({data: {count}}) => {
                  //
                  // MAXIMUM NUMBER OF FEATURES THAT MATCH OUR QUERY FILTER //
                  //
                  resolve({maxFeatureCount: count});
                });
              });
            };

            /**
             *
             * ITERATIVELY RETRIEVE ALL FEATURES
             *
             * @param {string} queryUrl
             * @param {string} queryFilter
             * @param {number} [startOffset]
             * @param {number} maxFeatureCount
             * @param {Graphic[]} [allFeatures]
             * @returns {Promise<{features:Graphic[]}>}
             * @private
             */
            const _getAllFeatures = ({queryUrl, queryFilter, startOffset = 0, maxFeatureCount, allFeatures = []}) => {
              return new Promise((resolve, reject) => {
                esriRequest(queryUrl, {
                  query: {
                    resultOffset: startOffset,
                    where: queryFilter,
                    outFields: '*',
                    f: 'geojson'
                  }
                }).then((response) => {
                  // GEOJSON FEATURES //
                  const {features} = response.data;

                  // AGGREGATED FEATURES //
                  allFeatures.push(...features);

                  // DO WE NEED TO RETRIEVE MORE FEATURES? //
                  if (allFeatures.length < maxFeatureCount) {
                    _getAllFeatures({
                      queryUrl,
                      queryFilter,
                      startOffset: allFeatures.length,
                      maxFeatureCount,
                      allFeatures
                    }).then(resolve).catch(reject);
                  } else {
                    // WE HAVE THEM ALL //
                    resolve({features: allFeatures});
                  }
                });
              });
            };

            //
            // WHEN PORTAL ITEM IS SELECTED //
            // UI STUFF //
            //
            this.diagramReaderUI.addEventListener('portal-item-selected', ({detail: {portalItem}}) => {
              // SOURCE PORTAL ITEM //
              this.sourcePortalItem = portalItem;

              // GET RPOJECT ID FROM TYPEKEYWORD //
              const projectIDKeyword = this.sourcePortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));
              const projectID = projectIDKeyword.replace(/geodesignProjectID/, '');

              // SOURCE SCENARIO FILTER //
              const sourceScenarioID = this.sourcePortalItem.id;
              const sourceScenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ sourceScenarioID }')`;
              console.info("Source Scenario Filter: ", sourceScenarioFilter);

              // QUERY REST ENDPOINT //
              const geoPlannerScenarioLayerQueryUrl = `${ this.sourcePortalItem.url }/${ this.interventionLayerId }/query`;
              // QUERY WHERE CLAUSE //
              const queryWhereClause = `${ sourceScenarioFilter } AND (ACTION_IDS IS NOT NULL)`;

              //
              // GET MAXIMUM NUMBER OF FEATURES THAT MATCH OUR QUERY FILTER
              //
              _getFeatureCount({
                queryUrl: geoPlannerScenarioLayerQueryUrl,
                queryFilter: queryWhereClause
              }).then(({maxFeatureCount}) => {

                //
                // GET THE FEATURES AS GEOJSON DIRECTLY FROM THE REST ENDPOINT //
                //  - esri/request IS A GENERIC METHOD TO MAKE DIRECT WEB CALLS BUT WILL HANDLE ESRI SPECIFIC USE-CASES
                //      DOC: https://developers.arcgis.com/javascript/latest/api-reference/esri-request.html
                //  - HERE WE USE IT TO MAKE A DIRECT CALL TO THE QUERY REST ENDPOINT OF THE FEATURE LAYER
                //
                //  - NOTE: CURRENTLY ALSO FILTERING OUT FEATURES WITH 'NA' IN THE SYSTEM FIELD
                //          AND NOT SURE IF WE'LL ALWAYS NEED THIS...
                //
                _getAllFeatures({
                  queryUrl: geoPlannerScenarioLayerQueryUrl,
                  queryFilter: queryWhereClause,
                  maxFeatureCount
                }).then(({features}) => {

                  //
                  // DID WE EXCEED THE MAXIMUM NUMBER OF FEATURES ALLOWED BY THE SERVICE?
                  //
                  // - NOTE: THIS SHOULD NO LONGER HAPPEN...
                  //
                  console.info(`Features found: ${ features.length } of ${ maxFeatureCount }`);
                  console.assert(features.length <= maxFeatureCount, 'Exceeded maximum limit of features');

                  // GEOPLANNER SOURCE SCENARIO FEATURES //
                  this.sourceScenarioFeaturesGeoJSON = features;

                  //
                  // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
                  //
                  this.diagramReaderUI.displayFeaturesList(this.sourceScenarioFeaturesGeoJSON);

                  this.dispatchEvent(new CustomEvent('geoplanner-features', {
                    detail: {
                      sourceScenarioFeaturesGeoJSON: this.sourceScenarioFeaturesGeoJSON
                    }
                  }));

                });
              });

            });

            //
            // DELETE GPL SCENARIO //
            //
            // https://developers.arcgis.com/rest/services-reference/enterprise/delete-features.htm
            //
            this.diagramReaderUI.addEventListener('portal-item-delete', ({detail: {portalItem}}) => {

              // DELETE REST ENDPOINT //
              const geoPlannerScenarioLayerDeleteUrl = `${ portalItem.url }/${ this.interventionLayerId }/deleteFeatures`;

              // DELETE FEATURES //
              esriRequest(geoPlannerScenarioLayerDeleteUrl, {
                query: {
                  where: `(Geodesign_ScenarioID = '${ portalItem.id }')`,
                  f: 'json'
                },
                method: 'post'
              }).then((deleteFeaturesResponse) => {
                console.info("Delete Features: ", deleteFeaturesResponse.data.deleteResults);
                this.portal.user.deleteItem(portalItem).then(() => {
                  console.info("Portal Item deleted");
                }).catch(console.error);
              }).catch(console.error);

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

      /**
       * ASK PORTAL TO FIND GEOPLANNER GROUPS
       * - groups with IGC in the title and these tags: geodesign | geodesignScenario
       */
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
       *  - group items with these tags: geodesign | geodesignScenario
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
   * @param {Graphic[]} designFeaturesAsEsriJSON
   * @param {string} designTeamName
   * @param {string} designName
   * @returns {Promise<{newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs}>}
   */
  createNewGeoPlannerScenario({designFeaturesAsEsriJSON, designTeamName, designName}) {
    return new Promise((resolve, reject) => {

      //
      // CREATE TARGET SCENARIO PORTAL ITEM //
      //  - THIS WILL GIVE US THE NECESSARY NEW SCENARIO ID...
      //
      this._createNewGeoPlannerScenarioPortalItem({designTeamName, designName}).then(({newPortalItem, projectID, scenarioID, scenarioFilter}) => {

        // UPDATE NEW SCENARIO FEATURES //
        //
        // - TODO: THESE MODIFICATIONS WILL HAVE TO HAPPEN AND WILL CHANGE AS WE MOVE THE PROJECT FORWARD...
        //
        const updatedDesignFeaturesAsEsriJSON = this._updateScenarioCandidates(designFeaturesAsEsriJSON, projectID, scenarioID);
        console.info("Updated negotiated GDH diagrams as Esri features: ", updatedDesignFeaturesAsEsriJSON);

        // ADD NEW GEOPLANNER SCENARIO FEATURES //
        this._addNewGeoPlannerScenarioFeatures({designFeaturesAsEsriJSON: updatedDesignFeaturesAsEsriJSON, newPortalItem}).then(({addFeaturesOIDs}) => {
          resolve({newPortalItem, scenarioID, scenarioFilter, addFeaturesOIDs});
        }).catch(reject);
      }).catch(reject);
    });
  }

  /**
   *
   * PortalItem: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html
   *
   * @param {string} designTeamName
   * @param {string} designName
   * @returns {Promise<{newPortalItem: PortalItem, projectID: string, scenarioID: string, scenarioFilter: string}>}
   * @private
   */
  _createNewGeoPlannerScenarioPortalItem({designTeamName, designName}) {
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
          //             DESIGN RELATED METADATA
          //
          const newPortalItem = new PortalItem({
            type: this.sourcePortalItem.type,
            url: this.sourcePortalItem.url,
            title: `GDH Team: ${ designTeamName } | Design: ${ designName }`,
            snippet: `A GDH negotiated design by team ${designTeamName}`,
            description: `${ this.sourcePortalItem.description || '' } - The GDH negotiated design ${ designName } by team ${ designTeamName }.`,
            accessInformation: this.sourcePortalItem.accessInformation || 'FOR USE BY IGC ONLY',
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
              newScenarioPortalItem.update({data: updatedLayerPortalItemData}).then((updatedScenarioPortalItem) => {
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

                    resolve({newPortalItem: updatedScenarioPortalItem, projectID, scenarioID, scenarioFilter});

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
   * @param {{}[]} candidateFeatures
   * @param {string} projectID
   * @param {string} scenarioID
   * @returns {{geometry:{}, attributes:{}}[]}
   */
  _updateScenarioCandidates(candidateFeatures, projectID, scenarioID) {

    //
    // CREATE A FEATURE FOR EACH DIAGRAM //
    // - NOTE: ONLY FEATURES WITH POLYGON GEOMETRIES ALLOWED CURRENTLY...
    //
    return candidateFeatures.filter(diagramFeature => {
      return (diagramFeature.geometry.rings != null);
    }).map(diagramFeature => {
      return {
        geometry: diagramFeature.geometry,
        attributes: {
          Geodesign_ProjectID: projectID,
          Geodesign_ScenarioID: scenarioID,
          SOURCE_ID: diagramFeature.attributes.notes,
          ACTION_IDS: diagramFeature.attributes.tag_codes,
          name: diagramFeature.attributes.description
        }
      };
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
            //rollbackOnFailure: false,
            f: 'json'
          },
          method: 'post'
        }).then((response) => {

          // RESULTS OF ADDING NEW FEATURES //
          const {addResults} = response.data;

          // LIST OF OBJECTIDS OF NEWLY ADDED FEATURES //
          // - APPLY EDITS RETURNS THE NEW OBJECTIDS OF ADDED FEATURES - OR ERROR IF FAILED //
          const addFeaturesOIDs = addResults.reduce((oids, addFeatureResult) => {
            console.assert(!addFeatureResult.error, addFeatureResult.error);
            return addFeatureResult.error ? oids : oids.concat(addFeatureResult.objectId);
          }, []);

          resolve({addFeaturesOIDs});
        }).catch(reject);
      });
    });
  }

}

export default DiagramReader;
