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
/**
 *
 * DiagramReaderUI
 *  - UI for DiagramReader
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  12/20/2022 - 0.0.1 -
 * Modified:
 *
 */

class DiagramReaderUI extends EventTarget {

  static version = '0.0.1';

  #portalUser;
  set portalUser(value) {
    this.#portalUser = value;
    this._displayPortalUser();
  }

  /**
   *
   */
  #geoPlannerProjectGroups;
  set geoPlannerProjectGroups(value) {
    this.#geoPlannerProjectGroups = value;
    this._displayGeoPlannerProjectGroups();
  }

  /**
   *
   */
  #geoPlannerProjectGroupItems;
  set geoPlannerProjectGroupItems(value) {
    this.#geoPlannerProjectGroupItems = value;
    this._displayPortalItemsList();
  }

  #sourceScenarioFilter;
  set sourceScenarioFilter(value) {
    this.#sourceScenarioFilter = value;
    this._displayScenarioFilter();
  }

  constructor() {
    super();

    this.signInUserLabel = document.getElementById('sign-in-user-label');

    this.geoPlannerGroupsList = document.getElementById('geoplanner-groups-list');
    this.portalItemsList = document.getElementById('geoplanner-items-list');
    this.geoplannerSourceItemDetails = document.getElementById('geoplanner-source-item-details');
    this.gdhDiagramsList = document.getElementById('gdh-diagrams-list');

    // TOGGLE PANE SECTIONS //
    document.querySelectorAll('.pane').forEach(paneNode => {
      paneNode.querySelector('.toggle')?.addEventListener('click', () => {
        paneNode.classList.toggle('collapsed');
      });
    });

  }

  /**
   *
   * @private
   */
  _displayPortalUser() {
    this.signInUserLabel.innerHTML = this.#portalUser?.username || '[ not signed in ]';
  }

  /**
   *
   * @private
   */
  _displayGeoPlannerProjectGroups() {
    if (this.#geoPlannerProjectGroups?.length) {

      const groupListItems = this.#geoPlannerProjectGroups.map(geoPlannerGroup => {
        const groupListItem = document.createElement('div');
        groupListItem.classList.add('geoplanner-list-item');
        groupListItem.innerHTML = geoPlannerGroup.title;

        groupListItem.addEventListener('click', () => {
          this.geoPlannerGroupsList.querySelector('.geoplanner-list-item.selected')?.classList.remove('selected');
          groupListItem.classList.add('selected');

          this.dispatchEvent(new CustomEvent('portal-group-selected', {detail: {portalGroup: geoPlannerGroup}}));
        });

        return groupListItem;
      });
      this.geoPlannerGroupsList.replaceChildren(...groupListItems);

    } else {
      this.geoPlannerGroupsList.replaceChildren();
    }
  }

  /**
   *
   * @private
   */
  _displayPortalItemsList() {
    if (this.#geoPlannerProjectGroupItems?.length) {

      // LAYER PORTAL ITEMS //
      // - A PORTAL ITEM REPRESENTS THE SIMPLE METADATA ABOUT A GIS THING (MAP, LAYER, ETC...)
      //   AND IN THIS CASE WE'RE JUST INTERESTED IN THE FEATURE LAYERS...
      const layerPortalItems = this.#geoPlannerProjectGroupItems.filter(item => item.isLayer);

      // GEOPLANNER DESIGN LAYERS ITEMS //
      const layerItemNodes = layerPortalItems.map(layerPortalItem => {

        const layerItemNode = document.createElement('div');
        layerItemNode.classList.add('geoplanner-list-item');
        layerItemNode.innerHTML = `[${ layerPortalItem.id }] ${ layerPortalItem.title }`;

        layerItemNode.addEventListener('click', () => {
          this.portalItemsList.querySelector('.geoplanner-list-item.selected')?.classList.remove('selected');
          layerItemNode.classList.add('selected');

          this.dispatchEvent(new CustomEvent('portal-item-selected', {detail: {portalItem: layerPortalItem}}));
        });

        return layerItemNode;
      });

      // DISPLAY LIST OF ALL GEOPLANNER LAYER ITEMS //
      this.portalItemsList.replaceChildren(...layerItemNodes);

    } else {
      this.portalItemsList.replaceChildren();
    }
  }

  /**
   *
   * @private
   */
  _displayScenarioFilter() {
    this.geoplannerSourceItemDetails.innerHTML = this.#sourceScenarioFilter || '';
  }

  /**
   * DISPLAY LIST OF FEATURES
   *
   * @param {{}[]} features scenario or design features as GeoJSON
   * @returns {Map<string, Graphic[]>} features/diagrams organized by system
   * @private
   */
  displayFeaturesList( features) {

    const diagramBySystems = new Map();

    const diagramItems = features.map(diagramFeature => {

      // DIAGRAM ATTRIBUTES //
      const diagramAttributes = diagramFeature.properties || diagramFeature.attributes;

      // FEATURE ID //
      const oid = diagramFeature.id || diagramAttributes.OBJECTID;

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

      //
      // ORGANIZE FEATURES/DIAGRAMS BY SYSTEM //
      // - JUST SIMPLE BINNING BY SYSTEM...
      //
      const diagramBySystem = diagramBySystems.get(Intervention_System) || [];
      diagramBySystem.push(diagramFeature);
      diagramBySystems.set(Intervention_System, diagramBySystem);

      return diagramItem;
    });
    // ADD DIAGRAMS TO LIST //
    this.gdhDiagramsList.replaceChildren(...diagramItems);

    return diagramBySystems;
  }

}

export default DiagramReaderUI;
