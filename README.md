# Geodesign Hub Diagrams

Simple app showing how to use the ArcGIS API for JavaScript to connect to discover IGC GeoPlanner specific content.

### APIs Used

 - [ArcGIS API for Javascript](https://developers.arcgis.com/javascript/latest/api-reference/)
 - [ArcGIS Rest API - Content Management](https://developers.arcgis.com/rest/users-groups-and-items/working-with-users-groups-and-items.htm)
 - [Geodesignhub](https://www.geodesignhub.com/)
 - [Geodesignhub API](https://www.geodesignhub.com/api/)

### [Check out the test app here](https://geoxc-apps.bd.esri.com/IGC/GDHDiagrams/DiagramReader.html)


### The Process

1. Authenticate user via OAuth
2. Find GeoPlanner Project Groups
   1. Select one Group 
3. Find GeoPlanner Scenario Portal Items in selected Group
   1. Select one Portal Item 
4. Query GeoPlanner Scenario features as GeoJSON

> NOTE: step 5 below is currently simulated by picking some random features 
 
5. Create new Geodesignhub Project, you can select the "Global Climate Action" template to prepopulate the project setup correctly. 
   1. Get your project ID and API token from Geodesignhub, for more information see [support article](https://community.geodesignhub.com/t/where-is-my-project-id/1275)
   2. Use list of features as a base set of diagrams for Geodesignhub
   3. Each feature becomes one or more GDH diagrams in the appropriate Geodesignhub system, this plugin will manage the migration provided that the project has been correctly setup (see instructions above regarding selectin the correct project setup template)
      1. The diagrams will be organized by system
   4. Perform negotiations resulting in one or two GDH Designs
      1. NOTE: Each GDH negotiated Design will be set of features in Esri JSON format
6. For each GDH Design
   1. Create new GeoPlanner Scenario Portal Item
      1. NOTE: The Scenario ID will be the new Portal Item id 
   2. Set sublayer Scenario specific filter
   3. Update feature attributes as needed
      1. NOTE: updating scenario ID is critical
      2. Update actions/interventions attribute as needed 
   4. Add GDH Design diagrams/features as new features to the Scenario Portal Item
      1. Confirm number of added features
   

#### For questions about the demo web application:
> John Grayson | Prototype Specialist | Geo Experience Center\
> Esri | 380 New York St | Redlands, CA 92373 | USA\
> T 909 793 2853 x1609 | [jgrayson@esri.com](mailto:jgrayson@esri.com) | [GeoXC Demos](https://GeoXC.esri.com) | [esri.com](https://www.esri.com)
