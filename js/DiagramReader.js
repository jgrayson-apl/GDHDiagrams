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
      const gdhFeaturesList = document.getElementById('gdh-features-list');
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
            layerItemNode.innerHTML = `[${ layerPortalItem.id }] ${ layerPortalItem.title }`;

            return layerItemNode;
          });
          // DISPLAY LIST OF ALL GEOPLANNER LAYER ITEMS //
          geoplannerItemsList.replaceChildren(...layerItemNodes);

          // SELECT FIRST FEATURE LAYER ITEM FOUND //
          const firstLayerPortalItem = layerPortalItems[0];

          // GET THE LAYER FROM THE PORTAL ITEM //
          Layer.fromPortalItem(firstLayerPortalItem).then((layer) => {
            // THE GEOPLANNER LAYER ITEM REFERENCES A LAYER WITH MULTIPLE SUBLAYERS
            // SO WE GET BACK A GROUP LAYER WITH TWO FEATURE LAYERS
            // SO WE THEN MAKE SURE ALL SUB LAYERS ARE LOADED...
            layer.loadAll().then(() => {

              // INTERVENTIONS LAYER //
              //  - hardocded to find a layer with a title that includes 'interventions'...
              //  - TODO: FIND BETTER WAY TO HANDLE THIS...
              const interventionsLayer = layer.layers.find(l => l.title.toLowerCase().includes('interventions'));
              // DISPLAY NAME OF GEOPLANNER DESIGN LAYER //
              geoplannerItemLabel.innerHTML = interventionsLayer.title;

              // DISPLAY FILTER USED OF THE GEOPLANNER DESIGN LAYER //
              // - THIS WILL SHOW THE DEFAULT QUERY USED FOR THIS LAYER
              // - AND SHOWS THE ID OF THE GEOPLANNER PROJECT AND DESIGN
              geoplannerItemDetails.innerHTML = interventionsLayer.definitionExpression;

              //
              //  IMPORTANT: createQuery() WILL USE THE LAYER DEFINITION EXPRESSION WHICH PROVIDES A SCENARIO SPECIFIC FILTER
              //    - WE WANT THE GEOMETRY AND ALL THE FIELDS SO WE CAN REPLICATE THEM WHEN ADDING AS NEW DESIGN/PLAN...
              //
              const analysisQuery = interventionsLayer.createQuery();

              // DIAGRAMS FILTER //
              const diagramsFilter = `${ analysisQuery.where } AND (Intervention_System <> 'NA')`;  // TODO: REPLACE 'NA' WITH NULL VALUES?

              // SET ANALYSIS QUERY PARAMETERS //
              analysisQuery.set({
                where: diagramsFilter,
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

                // CREATE AN ITEM FOR EACH FEATURE/DIAGRAM //
                const diagramItems = analysisFS.features.map(diagramFeature => {

                  // THIS PROVIDES A SIMPLE OBJECT TO HOLD RELEVANT FEATURE/DIAGRAM PROPERTIES //
                  const planInfo = {
                    'objectid': diagramFeature.getObjectId(),
                    'project': diagramFeature.attributes['Geodesign_ProjectID'],
                    'scenario_plan': diagramFeature.attributes['Geodesign_ScenarioID'],
                    'intervention_system': diagramFeature.attributes['Intervention_System'],
                    'intervention_type': diagramFeature.attributes['Intervention_Type']
                  };

                  // FEATURE/DIAGRAM ITEM //
                  const diagramItem = document.createElement('div');
                  diagramItem.classList.add('diagram-item');
                  diagramItem.innerHTML = `[ ${ planInfo.objectid } ] ${ planInfo.intervention_system } | ${ planInfo.intervention_type }`;

                  // GET COLOR USED IN GEOPLANNER FOR THIS FEATURE //
                  getDiagramColor({plansLayer: interventionsLayer, diagramFeature}).then(({color}) => {
                    diagramItem.style.borderLeftColor = color.toCss();
                  });

                  // ORGANIZE FEATURES/DIAGRAMS BY SYSTEM //
                  const diagramBySystem = diagramBySystems.get(planInfo.intervention_system) || [];
                  diagramBySystem.push(diagramFeature);
                  diagramBySystems.set(planInfo.intervention_system, diagramBySystem);

                  return diagramItem;
                });
                // ADD DIAGRAMS TO LIST //
                gdhFeaturesList.replaceChildren(...diagramItems);

                //
                // THIS IS THE ORGANIZED LIST OF DIAGRAMS BY SYSTEM //
                //
                console.info(diagramBySystems);

              });

              //
              // GET GEOJSON //
              //
              const directQueryUrl = `${ interventionsLayer.url }/${ interventionsLayer.layerId }/query`;
              esriRequest(directQueryUrl, {
                query: {
                  where: analysisQuery.where,
                  outFields: '*',
                  f: 'geojson'
                },
                responseType: "json"
              }).then((response) => {
                const data = response.data;
                console.info("GeoJSON via esriRequest(): ", data);

                //
                // DIAGRAM FEATURES ORGANIZED BY SYSTEM //
                //
                const diagramBySystemsGeoJSON = new Map();

                const diagramItems = data.features.map(diagramFeature => {

                  // THIS PROVIDES A SIMPLE OBJECT TO HOLD RELEVANT FEATURE/DIAGRAM PROPERTIES //
                  const planInfo = {
                    'objectid': diagramFeature.properties['OBJECTID'],
                    'project': diagramFeature.properties['Geodesign_ProjectID'],
                    'scenario_plan': diagramFeature.properties['Geodesign_ScenarioID'],
                    'intervention_system': diagramFeature.properties['Intervention_System'],
                    'intervention_type': diagramFeature.properties['Intervention_Type']
                  };

                  // FEATURE/DIAGRAM ITEM //
                  const diagramItem = document.createElement('div');
                  diagramItem.classList.add('diagram-item');
                  diagramItem.innerHTML = `[ ${ planInfo.objectid } ] ${ planInfo.intervention_system } | ${ planInfo.intervention_type }`;

                  // GET COLOR USED IN GEOPLANNER FOR THIS FEATURE //
                  // getDiagramColor({plansLayer: interventionsLayer, diagramFeature}).then(({color}) => {
                  //   diagramItem.style.borderLeftColor = color.toCss();
                  // });

                  // ORGANIZE FEATURES/DIAGRAMS BY SYSTEM //
                  const diagramBySystem = diagramBySystemsGeoJSON.get(planInfo.intervention_system) || [];
                  diagramBySystem.push(diagramFeature);
                  diagramBySystemsGeoJSON.set(planInfo.intervention_system, diagramBySystem);

                  return diagramItem;
                });
                // ADD DIAGRAMS TO LIST //
                gdhDiagramsList.replaceChildren(...diagramItems);

                //
                // THIS IS THE ORGANIZED LIST OF DIAGRAMS BY SYSTEM //
                //
                console.info(diagramBySystemsGeoJSON);

              });

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
