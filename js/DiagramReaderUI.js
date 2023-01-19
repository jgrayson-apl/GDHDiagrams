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
  }

  constructor() {
    super();

    this.signInUserLabel = document.getElementById('sign-in-user-label');

    this.geoPlannerGroupsList = document.getElementById('geoplanner-groups-list');
    this.geoplannerGroupBtn = document.getElementById('geoplanner-group-btn');

    this.portalItemsList = document.getElementById('geoplanner-items-list');
    this.geoplannerItemsBtn = document.getElementById('geoplanner-items-btn');

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

        const groupListItem = document.createElement('option');
        groupListItem.setAttribute('value', geoPlannerGroup.id);
        groupListItem.innerHTML = geoPlannerGroup.title;

        return groupListItem;
      });
      this.geoPlannerGroupsList.replaceChildren(...groupListItems);

    } else {
      this.geoPlannerGroupsList.replaceChildren();
    }

    this.geoplannerGroupBtn.addEventListener('click', () => {
      const geoPlannerGroup = this.#geoPlannerProjectGroups.find(group => group.id === this.geoPlannerGroupsList.value);
      this.dispatchEvent(new CustomEvent('portal-group-selected', {detail: {portalGroup: geoPlannerGroup}}));
    });

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

        const layerItemNode = document.createElement('option');
        layerItemNode.setAttribute('value', layerPortalItem.id);
        layerItemNode.innerHTML = layerPortalItem.title;

        return layerItemNode;
      });

      // DISPLAY LIST OF ALL GEOPLANNER LAYER ITEMS //
      this.portalItemsList.replaceChildren(...layerItemNodes);

    } else {
      this.portalItemsList.replaceChildren();
    }

    this.geoplannerItemsBtn.addEventListener('click', () => {
      const layerPortalItem = this.#geoPlannerProjectGroupItems.find(item => item.id === this.portalItemsList.value);
      this.dispatchEvent(new CustomEvent('portal-item-selected', {detail: {portalItem: layerPortalItem}}));
    });
  }

  /**
   * DISPLAY LIST OF FEATURES
   *
   * @param {{}[]} features scenario or design features as GeoJSON
   */
  displayFeaturesList(features) {

    const diagramItems = features.map(diagramFeature => {

      // DIAGRAM ATTRIBUTES //
      const diagramAttributes = diagramFeature.properties || diagramFeature.attributes;

      // FEATURE ID //
      const oid = diagramFeature.id || diagramAttributes.OBJECTID;

      // RELEVANT FEATURE/DIAGRAM PROPERTIES //
      const {
        Geodesign_ProjectID,
        Geodesign_ScenarioID,
        ACTION_IDS
      } = diagramAttributes;

      // FEATURE/DIAGRAM ITEM //
      const diagramItem = document.createElement('div');
      diagramItem.classList.add('diagram-item');
      diagramItem.innerHTML = `[ ${ oid } ] ${ ACTION_IDS }`;
      diagramItem.title = JSON.stringify(diagramFeature, null, 2);

      const geometryParts = diagramFeature.geometry.coordinates || diagramFeature.geometry.rings;
      const isMultiPartGeometry = (geometryParts.length > 1);
      isMultiPartGeometry && diagramItem.classList.add('multipart');

      return diagramItem;
    });
    // ADD DIAGRAMS TO LIST //
    this.gdhDiagramsList.replaceChildren(...diagramItems);
  }

}

export default DiagramReaderUI;
