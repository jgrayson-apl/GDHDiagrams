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

class Application extends EventTarget {

  static CONFIG = {
    PORTAL_URL: "https://www.arcgis.com",
    OAUTH_APP_ID: "PZdAgiu187TroTCX",
    IGC_GROUP_ID: ''
  };

  // GROUP IDS //
  // static IGC_GROUP_IDS = [
  //   '5a0eb4eacfe94da6800089441a7ea2b7',  // Global GeoDesign Preview items
  //   '9e4b9642677e4ee38a8aa72ab1691297' // Socal Prototype Staging for Esri
  // ];

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

      // INITIALIZE GROUP CONTENT SELECTION //
      this.initializeGroupSelection({portal});

      // INITIALIZE MAP VIEW //
      this.initializeMapView().then(({view}) => {

        // INITIALIZE MANAGEMENT OF MAP LAYERS //
        this.initializeMapLayers({view});

        // INITIALIZE SKETCH TOOLS //
        this.initializeSketchTools({view});

        // INITIALIZE ANALYSIS //
        this.initializeAnalysis({view});

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
          portalUrl: Application.CONFIG.PORTAL_URL,
          appId: Application.CONFIG.OAUTH_APP_ID,
          popup: true
        });
        esriId.registerOAuthInfos([oauthInfo]);

        // PORTAL //
        const portal = new Portal({url: Application.CONFIG.PORTAL_URL});

        // SHARING URL //
        const portalSharingURL = `${ Application.CONFIG.PORTAL_URL }/sharing`;

        // CHECK THE SIGN-IN STATUS
        esriId.checkSignInStatus(portalSharingURL).then(() => {
          return esriId.getCredential(portalSharingURL);
        }).catch(() => {
          // IF USER IS NOT SIGNED IN THEN ASK THE USER TO SIGN IN NOW... //
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
   * @returns {Promise<MapView>}
   */
  initializeMapView() {
    return new Promise((resolve, reject) => {
      require([
        'esri/core/reactiveUtils',
        'esri/Map',
        'esri/views/MapView',
        "esri/widgets/Expand",
        'esri/widgets/Home',
        'esri/widgets/Search',
        'esri/widgets/Legend',
        'esri/widgets/LayerList',
        'esri/widgets/Slider'
      ], (reactiveUtils, EsriMap, MapView, Expand, Home, Search, Legend, LayerList, Slider) => {

        // MAP VIEW CONTAINER ELEMENT ID //
        const mapViewContainerId = 'view-container';

        // CREATE MAP VIEW //
        const view = new MapView({
          container: mapViewContainerId,
          map: new EsriMap({
            basemap: 'topo-vector'
          }),
          constraints: {snapToZoom: false},
          zoom: 5,
          center: [-97.0, 38.0],
          popup: {
            dockEnabled: true,
            dockOptions: {
              buttonEnabled: false,
              breakpoint: false,
              position: "bottom-left"
            }
          }
        });
        view.when(() => {
          // WHEN THE VIEW IS CREATED //

          // SEARCH //
          const search = new Search({view});
          const searchExpand = new Expand({view, content: search});
          view.ui.add(searchExpand, {position: 'top-left', index: 0});

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-left', index: 1});

          // LEGEND //
          const legend = new Legend({container: 'legend-container', view});

          // LAYER LIST //
          const layerList = new LayerList({
            container: 'layer-list-container',
            view: view,
            visibleElements: {statusIndicators: true},
            listItemCreatedFunction: ({item}) => {

              const slider = new Slider({
                min: 0, max: 1, precision: 2, values: [item.layer.opacity],
                visibleElements: {labels: false, rangeLabels: true}
              });
              slider.on("thumb-drag", (event) => {
                item.layer.opacity = event.value;
              });

              item.set({
                open: true,
                actionsOpen: true,
                panel: {
                  open: true,
                  title: 'opacity',
                  className: "esri-icon-experimental",
                  content: slider
                },
                actionsSections: [
                  [
                    {
                      id: "full-extent",
                      type: 'button',
                      title: "Go to full extent",
                      className: "esri-icon-zoom-out-fixed"
                    },
                    {
                      id: "blend-mode",
                      type: 'toggle',
                      value: (item.layer.blendMode === 'multiply'),
                      title: "Blend Mode: multiply"
                    }
                  ]
                ]
              });
            }
          });

          layerList.on("trigger-action", (evt) => {
            const id = evt.action.id;
            if (id === "full-extent") {
              view.goTo(evt.item.layer.fullExtent);
            }
            if (id === "blend-mode") {
              evt.item.layer.blendMode = evt.action.value ? 'multiply' : 'normal';
            }
          });

          resolve({view});
        });
      });
    });
  }

  /**
   *
   * @param {MapView} view
   */
  initializeMapLayers({view}) {
    require([
      'esri/layers/Layer'
    ], (Layer) => {

      const sourceLayerInput = document.getElementById('source-layer-input');

      // LIST OF LAYERS BY PORTAL ITEM ID //
      const layerByPortalItemID = new Map();

      // TOGGLE LAYER INCLUSION IN MAP //
      this.addEventListener('layer-toggle', ({detail: {portalItem, selected}}) => {
        // DO WE HAVE THE LAYER CACHED? //
        const layer = layerByPortalItemID.get(portalItem.id);

        // SHOULD WE ADD OF REMOVE THE LAYER FROM THE MAP? //
        if (selected) {

          // DO WE ALREADY HAVE THE LAYER CACHED? //
          if (layer) {
            // THEN JUST ADD TO THE MAP //
            view.map.add(layer, 0);

            if (layer.type === 'feature') {
              sourceLayerInput.value = portalItem.title;
              this.setAnalysisLayer({layer});
            }

          } else {
            // THEN CREATE DIRECTLY FROM PORTAL ITEM //
            Layer.fromPortalItem(portalItem).then((mapLayer) => {
              // CACHE LAYER SO WE DON'T HAVE TO CREATE IT AGAIN IN THIS SESSION //
              layerByPortalItemID.set(portalItem.id, mapLayer);
              // ADD LAYER TO MAP //
              view.map.add(mapLayer, 0);

              if (mapLayer.type === 'feature') {
                sourceLayerInput.value = portalItem.title;
                this.setAnalysisLayer({layer: mapLayer});
              }

            });
          }

        } else {
          // THE MAP LAYER SHOULD ALREADY BE CACHED SO REMOVE IT FROM THE MAP //
          layer && view.map.remove(layer);
          if (layer?.title === sourceLayerInput.value) {
            sourceLayerInput.value = null;
            this.setAnalysisLayer({layer: null});
          }
        }
      });

      // CLEAR OPERATIONAL LAYERS FROM THE MAP //
      this.addEventListener('layers-clear', () => {
        const notGraphicsLayers = view.map.layers.filter(layer => layer.type !== 'graphics');
        view.map.removeMany(notGraphicsLayers);

        sourceLayerInput.value = null;
        this.setAnalysisLayer({layer: null});
      });

    });
  }

  /**
   *
   * @param {Portal} portal
   */
  initializeGroupSelection({portal}) {

    // FIND GROUP //
    const groupsList = document.getElementById('groups-list');
    groupsList.addEventListener('calciteListChange', ({detail}) => {
      // GROUP ID //
      const groupId = detail.keys().next().value;

      // ASK PORTAL TO FIND GROUP //
      portal.queryGroups({query: `id: ${ groupId }`}).then(({results}) => {

        // CLEAR MAP LAYERS //
        this.dispatchEvent(new CustomEvent('layers-clear', {detail: {}}));

        // LIST THE GROUP LAYERS //
        this.initializeGroupLayers({portalGroup: results[0]});

      });
    });

  }

  /**
   *
   * @param {PortalGroup} portalGroup
   */
  initializeGroupLayers({portalGroup}) {

    // FIND GROUP LAYERS //
    const groupLayersList = document.getElementById('group-layers-list');
    if (portalGroup) {

      // ASK PORTAL GROUP TO RETURN PORTAL ITEMS //
      portalGroup.queryItems().then(({results}) => {

        // LAYER PORTAL ITEMS //
        const layerPortalItems = results.filter(item => item.isLayer);

        // LAYER LIST ITEMS //
        const layerListItems = layerPortalItems.map(this.createLayerListItem.bind(this));

        // ADD LAYER LIST ITEMS //
        groupLayersList.replaceChildren(...layerListItems);
      });

    } else {
      groupLayersList.replaceChildren();
    }
  }

  /**
   *
   * @param {PortalItem} layerPortalItem
   * @returns {HTMLElement}
   */
  createLayerListItem(layerPortalItem) {

    const layerListItem = document.createElement('calcite-pick-list-item');
    layerListItem.setAttribute('value', layerPortalItem.id);
    layerListItem.setAttribute('label', layerPortalItem.title);
    layerListItem.setAttribute('description', `Type: ${ layerPortalItem.displayName } | Source: ${ layerPortalItem.type }`);
    layerListItem.setAttribute('title', layerPortalItem.snippet);

    const layerAction = document.createElement('calcite-action');
    layerAction.setAttribute('slot', 'actions-start');
    layerAction.toggleAttribute('compact', true);
    layerListItem.append(layerAction);

    const layerIcon = document.createElement('img');
    layerIcon.src = layerPortalItem.iconUrl;
    layerAction.append(layerIcon);

    layerListItem.addEventListener('calciteListItemChange', ({detail: {selected}}) => {
      this.dispatchEvent(new CustomEvent('layer-toggle', {detail: {portalItem: layerPortalItem, selected}}));
    });

    return layerListItem;
  }

  /**
   *
   * @param {MapView} view
   */
  initializeSketchTools({view}) {
    require([
      'esri/core/reactiveUtils',
      'esri/layers/GraphicsLayer',
      "esri/widgets/Expand",
      'esri/widgets/Sketch'
    ], (reactiveUtils, GraphicsLayer, Expand, Sketch) => {

      // SKETCH LAYER //
      const sketchLayer = new GraphicsLayer({listMode: 'hide'});
      view.map.add(sketchLayer);

      // SKETCH //
      const sketch = new Sketch({
        view,
        layer: sketchLayer,
        creationMode: 'single',
        availableCreateTools: ['polygon', 'rectangle', 'circle'],
        defaultCreateOptions: {mode: 'hybrid'},
        visibleElements: {
          selectionTools: {
            "rectangle-selection": false,
            "lasso-selection": false
          }
        }
      });
      // SKETCH EXPAND //
      const sketchExpand = new Expand({view, content: sketch});
      view.ui.add(sketchExpand, {position: 'top-right', index: 0});

      // WHEN A NEW SKETCH HAS BEEN CREATED //
      sketch.on("create", (event) => {
        if (event.state === "complete") {
          this.dispatchEvent(new CustomEvent('analysis-geometry', {detail: {geometry: event.graphic.geometry}}));
        }
      });

      /*reactiveUtils.watch(() => !view.popup.visible, () => {
        sketchLayer.removeAll();
      });*/

    });
  }

  /**
   *
   * @param {MapView} view
   */
  initializeAnalysis({view}) {

    let analysisLayer = null;
    this.setAnalysisLayer = ({layer}) => {
      analysisLayer = layer;
    };

    this.addEventListener('analysis-geometry', ({detail: {geometry}}) => {
      if (analysisLayer) {
        view.whenLayerView(analysisLayer).then(analysisLayerView => {

          const analysisQuery = analysisLayerView.createQuery();
          analysisQuery.set({
            where: `1=1`,
            geometry
          });

          analysisLayerView.queryFeatures(analysisQuery).then(analysisFS => {
            // SELECTED FEATURES //
            const selectedFeatures = analysisFS.features;

            //
            // DO SOMETHING WITH SELECTED FEATURES //
            //
            view.popup.open({features: selectedFeatures});

          });
        });
      }
    });

  }

}

export default new Application();
