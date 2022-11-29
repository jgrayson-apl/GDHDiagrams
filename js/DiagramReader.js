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

      // FIND ALL IGC GEOPLANNER LAYERS //
      // AND SELECT THE FIRST ONE //
      this.initializeGeoPlannerLayers({portal});

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
      'esri/layers/Layer',
      'esri/symbols/support/symbolUtils'
    ], (Layer, symbolUtils) => {

      const getDiagramColor = ({plansLayer, diagramFeature}) => {
        return new Promise((resolve, reject) => {
          symbolUtils.getDisplayedColor(diagramFeature, {renderer: plansLayer.renderer}).then((color) => {
            resolve({color});
          });
        });
      };

      const geoplannerItemsList = document.getElementById('geoplanner-items-list');
      const geoplannerItemLabel = document.getElementById('geoplanner-item-label');
      const geoplannerItemDetails = document.getElementById('geoplanner-item-details');

      const gdhDiagramsList = document.getElementById('gdh-diagrams-list');

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
          const layerPortalItems = results.filter(item => item.isLayer);

          // GEOPLANNER DESIGN LAYERS //
          const layerItemNodes = layerPortalItems.map(layerPortalItem => {

            const layerItemNode = document.createElement('div');
            layerItemNode.classList.add('layer-item');
            layerItemNode.innerHTML = `[${layerPortalItem.id}] ${layerPortalItem.title}`;

            return layerItemNode;
          });
          // ADD LAYERS TO LIST  //
          geoplannerItemsList.replaceChildren(...layerItemNodes);


          // SELECT FIRST FEATURE LAYER ITEM FOUND //
          const firstLayerPortalItem = layerPortalItems[0];
          Layer.fromPortalItem(firstLayerPortalItem).then((layer) => {
            layer.loadAll().then(() => {

              // INTERVENTIONS LAYER //
              //  - hardocded to find a layer with a title that includes 'interventions'...
              //  - TODO: FIND BETTER WAY TO HANDLE THIS...
              const interventionsLayer = layer.layers.find(l => l.title.toLowerCase().includes('interventions'));

              // DISPLAY NAME OF GEOPLANNER DESIGN LAYER //
              geoplannerItemLabel.innerHTML = interventionsLayer.title;

              // DISPLAY FILTER USED OF THE GEOPLANNER DESIGN LAYER //
              // - THIS WILL SHOW THE DEFAULT QUERY USED FOR THIS LAYER
              // - THAT SHOW THE ID OF THE PROJECT AND DESIGN
              geoplannerItemDetails.innerHTML = interventionsLayer.definitionExpression;

              //
              //  IMPORTANT: createQuery() WILL USE THE LAYER DEFINITION EXPRESSION WHICH PROVIDES A SCENARIO SPECIFIC FILTER
              //    - WE WANT THE GEOMETRY AND ALL THE FIELDS SO WE CAN REPLICATE THEM WHEN ADDING AS NEW DESIGN/PLAN...
              //
              const analysisQuery = interventionsLayer.createQuery();
              analysisQuery.set({
                where: `${ analysisQuery.where } AND (Intervention_System <> 'NA')`,
                outFields: ['*'],
                returnGeometry: true
              });

              //
              // BREAK DOWN THE LIST OF FEATURES BY SYSTEM TO PRODUCE A LIST OF DIAGRAMS
              //
              interventionsLayer.queryFeatures(analysisQuery).then(analysisFS => {
                //console.info(analysisFS.features);

                //
                // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
                //
                const diagramBySystems = new Map();

                const diagramItems = analysisFS.features.map(diagramFeature => {

                  const planInfo = {
                    'objectid': diagramFeature.getObjectId(),
                    'project': diagramFeature.attributes['Geodesign_ProjectID'],
                    'scenario_plan': diagramFeature.attributes['Geodesign_ScenarioID'],
                    'intervention_system': diagramFeature.attributes['Intervention_System'],
                    'intervention_type': diagramFeature.attributes['Intervention_Type']
                  };

                  const diagramItem = document.createElement('div');
                  diagramItem.classList.add('diagram-item');
                  diagramItem.innerHTML = `[ ${ planInfo.objectid } ] ${ planInfo.intervention_system } | ${ planInfo.intervention_type }`;

                  getDiagramColor({diagramFeature}).then(({color}) => {
                    diagramItem.style.borderLeftColor = color.toCss();
                  });

                  const diagramBySystem = diagramBySystems.get(planInfo.scenario_plan) || [];
                  diagramBySystem.push(diagramFeature);
                  diagramBySystems.set(planInfo.scenario_plan, diagramBySystem);

                  return diagramItem;
                });

                // ADD DIAGRAMS TO LIST //
                gdhDiagramsList.replaceChildren(...diagramItems);

                console.info(diagramBySystems);
              });
            });
          });
        });

      } else {
        geoplannerItemsList.replaceChildren();
      }

    });
  }

  /**
   *
   * @param {MapView} view
   */
  initializeAnalysis({view}) {

    const planList = document.getElementById('plan-list');

    let analysisLayer = null;
    this.setAnalysisLayer = ({layer}) => {
      analysisLayer = layer;
      _getInterventions();
    };

    /**
     *
     * NOTE: WE CAN SKIP THIS COMPLETELY AND ASSUME THE PORTAL ITEM ONLY HAS ONE SCENARIO/PLAN
     *
     * @private
     */
    const _getInterventions = () => {
      if (analysisLayer) {

        //
        // GET UNIQUE LIST OF PLANS (GEOPLANNER SCENARIONS)
        //  - createQuery() WILL USE THE LAYER DEFINITION EXPRESSION WHICH PROVIDES A SCENARIO SPECIFIC FILTER
        //
        const analysisQuery = analysisLayer.createQuery();
        analysisQuery.set({
          outFields: ['Geodesign_ProjectID', 'Geodesign_ScenarioID'],
          returnDistinctValues: true,
          returnGeometry: false
        });
        analysisLayer.queryFeatures(analysisQuery).then(analysisFS => {
          //console.info(analysisFS.features);

          const planListItems = analysisFS.features.map(feature => {
            const projectID = feature.attributes.Geodesign_ProjectID;
            const scenarioID = feature.attributes.Geodesign_ScenarioID;

            const planListItem = document.createElement('calcite-pick-list-item');
            planListItem.setAttribute('value', scenarioID);
            planListItem.setAttribute('label', `Scenario: ${ scenarioID }`);
            planListItem.setAttribute('description', `Project: ${ projectID }`);

            planListItem.addEventListener('calciteListItemChange', ({detail: {selected}}) => {
              selected && _getPlanFeatures({projectID, scenarioID});
            });

            return planListItem;
          });
          planList.replaceChildren(...planListItems);

          // SELECT ONLY PLAN FOUND //
          if (planListItems.length === 1) {
            planListItems[0].toggleAttribute('selected', true);
          } else {
            console.warn('More than one GeoPlanner Scenario features found...');
          }

        });
      } else {
        planList.replaceChildren();
        _getPlanFeatures({});
      }
    };

    const diagramsList = document.getElementById('diagrams-list');

    //
    // GET ALL FEATURES FOR A PROJECT AND SCENARIO //
    //
    const _getPlanFeatures = ({projectID, scenarioID} = {}) => {
      if (analysisLayer && projectID && scenarioID) {

        //
        //  - createQuery() WILL USE THE LAYER DEFINITION EXPRESSION WHICH PROVIDES A SCENARIO SPECIFIC FILTER
        //
        const analysisQuery = analysisLayer.createQuery();
        analysisQuery.set({
          where: `${ analysisQuery.where } AND (Intervention_System <> 'NA')`,
          outFields: ['*'],
          returnGeometry: true
        });

        //
        // *I THINK* THIS IS WHERE WE BREAK DOWN THE LIST OF FEATURES BY SYSTEM...
        //
        analysisLayer.queryFeatures(analysisQuery).then(analysisFS => {
          //console.info(analysisFS.features);

          const planFeatures = analysisFS.features;

          planFeatures.map(diagramFeature => {

            const planInfo = {
              'objectid': diagramFeature.getObjectId(),
              'project': diagramFeature.attributes['Geodesign_ProjectID'],
              'scenario_plan': diagramFeature.attributes['Geodesign_ScenarioID'],
              'intervention_system': diagramFeature.attributes['Intervention_System'],
              'intervention_type': diagramFeature.attributes['Intervention_Type']
            };

            let listGroup = diagramsList.querySelector(`calcite-pick-list-group[group-title="${ planInfo.intervention_system }"]`);
            if (!listGroup) {
              listGroup = document.createElement('calcite-pick-list-group');
              listGroup.setAttribute('group-title', planInfo.intervention_system);
              diagramsList.append(listGroup);
            }

            const diagramItem = document.createElement('calcite-pick-list-item');
            diagramItem.setAttribute('value', planInfo.objectid);
            diagramItem.setAttribute('label', planInfo.intervention_type);
            diagramItem.setAttribute('title', JSON.stringify(planInfo, null, 2));
            diagramItem.addEventListener('click', () => {
              console.info('Diagram: ', diagramFeature.attributes);
            });
            listGroup.append(diagramItem);

            getDiagramColor({diagramFeature}).then(({color}) => {
              diagramItem.style.borderLeft = `solid 6px ${ color.toCss() }`;
            });

          });

        });
      }
    };

  }

}

export default new DiagramReader();
