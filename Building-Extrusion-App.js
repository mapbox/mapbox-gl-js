ViewController
import UIKit
import MapboxCoreNavigation
import MapboxNavigation
import MapboxDirections
import MapboxMaps
 
class BuildingExtrusionViewController: UIViewController, NavigationMapViewDelegate, NavigationViewControllerDelegate, UIGestureRecognizerDelegate {
 
typealias ActionHandler = (UIAlertAction) -> Void
 
var navigationMapView: NavigationMapView!
 
var navigationRouteOptions: NavigationRouteOptions!
 
var currentRoute: Route? {
get {
return routes?.first
}
set {
guard let selected = newValue else { routes = nil; return }
guard let routes = routes else { self.routes = [selected]; return }
self.routes = [selected] + routes.filter { $0 != selected }
}
}
 
var routes: [Route]? {
didSet {
guard let routes = routes, let currentRoute = routes.first else {
navigationMapView.removeRoutes()
navigationMapView.removeWaypoints()
waypoints.removeAll()
return
}
 
navigationMapView.show(routes)
navigationMapView.showWaypoints(on: currentRoute)
}
}
 
var waypoints: [Waypoint] = []
 
// MARK: - UIViewController lifecycle methods
 
override func viewDidLoad() {
super.viewDidLoad()
 
setupNavigationMapView()
setupPerformActionBarButtonItem()
setupGestureRecognizers()
}
 
// MARK: - Setting-up methods
 
func setupNavigationMapView() {
navigationMapView = NavigationMapView(frame: view.bounds)
navigationMapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
navigationMapView.delegate = self
navigationMapView.userLocationStyle = .puck2D()
 
// To make sure that buildings are rendered increase zoomLevel to value which is higher than 16.0.
// More details can be found here: https://docs.mapbox.com/vector-tiles/reference/mapbox-streets-v8/#building
let navigationViewportDataSource = NavigationViewportDataSource(navigationMapView.mapView, viewportDataSourceType: .raw)
navigationViewportDataSource.options.followingCameraOptions.zoomUpdatesAllowed = false
navigationViewportDataSource.followingMobileCamera.zoom = 17.0
navigationMapView.navigationCamera.viewportDataSource = navigationViewportDataSource
 
view.addSubview(navigationMapView)
}
 
func setupPerformActionBarButtonItem() {
let settingsBarButtonItem = UIBarButtonItem(title: NSString(string: "\u{2699}\u{0000FE0E}") as String, style: .plain, target: self, action: #selector(performAction))
settingsBarButtonItem.setTitleTextAttributes([.font: UIFont.systemFont(ofSize: 30)], for: .normal)
settingsBarButtonItem.setTitleTextAttributes([.font: UIFont.systemFont(ofSize: 30)], for: .highlighted)
navigationItem.rightBarButtonItem = settingsBarButtonItem
}
 
// MARK: - UIGestureRecognizer related methods
 
func setupGestureRecognizers() {
let longPressGestureRecognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
navigationMapView.addGestureRecognizer(longPressGestureRecognizer)
 
let tapGestureRecognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
tapGestureRecognizer.delegate = self
navigationMapView.addGestureRecognizer(tapGestureRecognizer)
}
 
@objc func performAction(_ sender: Any) {
let alertController = UIAlertController(title: "Perform action",
message: "Select specific action to perform it", preferredStyle: .actionSheet)
 
let startNavigation: ActionHandler = { _ in self.startNavigation() }
let toggleDayNightStyle: ActionHandler = { _ in self.toggleDayNightStyle() }
let unhighlightBuildings: ActionHandler = { _ in self.unhighlightBuildings() }
let removeRoutes: ActionHandler = { _ in self.routes = nil }
 
let actions: [(String, UIAlertAction.Style, ActionHandler?)] = [
("Start Navigation", .default, startNavigation),
("Toggle Day/Night Style", .default, toggleDayNightStyle),
("Unhighlight Buildings", .default, unhighlightBuildings),
("Remove Routes", .default, removeRoutes),
("Cancel", .cancel, nil)
]
 
actions
.map({ payload in UIAlertAction(title: payload.0, style: payload.1, handler: payload.2) })
.forEach(alertController.addAction(_:))
 
if let popoverController = alertController.popoverPresentationController {
popoverController.barButtonItem = navigationItem.rightBarButtonItem
}
 
present(alertController, animated: true, completion: nil)
}
 
func startNavigation() {
guard let route = currentRoute, let navigationRouteOptions = navigationRouteOptions else {
presentAlert(message: "Please select at least one destination coordinate to start navigation.")
return
}
 
let navigationService = MapboxNavigationService(route: route,
routeIndex: 0,
routeOptions: navigationRouteOptions,
simulating: simulationIsEnabled ? .always : .onPoorGPS)
let navigationOptions = NavigationOptions(navigationService: navigationService)
let navigationViewController = NavigationViewController(for: route,
routeIndex: 0,
routeOptions: navigationRouteOptions,
navigationOptions: navigationOptions)
navigationViewController.routeLineTracksTraversal = true
navigationViewController.delegate = self
navigationViewController.modalPresentationStyle = .fullScreen
navigationViewController.navigationMapView?.mapView.mapboxMap.style.uri = navigationMapView.mapView?.mapboxMap.style.uri
 
// Set `waypointStyle` to either `.building` or `.extrudedBuilding` to allow
// building highighting in 2D or 3D respectively.
navigationViewController.waypointStyle = .extrudedBuilding
 
present(navigationViewController, animated: true, completion: nil)
}
 
func toggleDayNightStyle() {
let style = navigationMapView.mapView?.mapboxMap.style
if style?.uri?.rawValue == MapboxMaps.Style.navigationNightStyleURL.absoluteString {
style?.uri = StyleURI(url: MapboxMaps.Style.navigationDayStyleURL)
} else {
style?.uri = StyleURI(url: MapboxMaps.Style.navigationNightStyleURL)
}
}
 
func unhighlightBuildings() {
waypoints.forEach({ $0.targetCoordinate = nil })
navigationMapView.unhighlightBuildings()
}
 
@objc func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
guard gesture.state == .began else { return }
 
createWaypoints(for: navigationMapView.mapView.mapboxMap.coordinate(for: gesture.location(in: navigationMapView.mapView)))
requestRoute()
}
 
@objc func handleTap(_ gesture: UITapGestureRecognizer) {
// In case if route is already shown on map do not allow selection of buildings other than final destination.
guard currentRoute == nil || navigationRouteOptions == nil else { return }
navigationMapView.highlightBuildings(at: [navigationMapView.mapView.mapboxMap.coordinate(for: gesture.location(in: navigationMapView.mapView))], in3D: true)
}
 
func createWaypoints(for destinationCoordinate: CLLocationCoordinate2D?) {
guard let destinationCoordinate = destinationCoordinate else { return }
guard let userCoordinate = navigationMapView.mapView.location.latestLocation?.coordinate else {
presentAlert(message: "User coordinate is not valid. Make sure to enable Location Services.")
return
}
 
// Unhighlight all buildings in case if there are no previous destination waypoints.
if waypoints.isEmpty {
unhighlightBuildings()
}
 
// In case if origin waypoint is not present in list of waypoints - add it.
let userLocationName = "User location"
let userWaypoint = Waypoint(coordinate: userCoordinate, name: userLocationName)
if waypoints.first?.name != userLocationName {
waypoints.insert(userWaypoint, at: 0)
}
 
// Add destination waypoint to list of waypoints.
let waypoint = Waypoint(coordinate: destinationCoordinate)
waypoint.targetCoordinate = destinationCoordinate
waypoints.append(waypoint)
}
 
func requestRoute() {
let navigationRouteOptions = NavigationRouteOptions(waypoints: waypoints)
Directions.shared.calculate(navigationRouteOptions) { [weak self] (_, result) in
switch result {
case .failure(let error):
self?.presentAlert(message: error.localizedDescription)
 
// In case if direction calculation failed - remove last destination waypoint.
self?.waypoints.removeLast()
case .success(let response):
guard let routes = response.routes else { return }
self?.navigationRouteOptions = navigationRouteOptions
self?.routes = routes
self?.navigationMapView.show(routes)
if let currentRoute = self?.currentRoute {
self?.navigationMapView.showWaypoints(on: currentRoute)
}
 
if let coordinates = self?.waypoints.compactMap({ $0.targetCoordinate }) {
self?.navigationMapView.highlightBuildings(at: coordinates, in3D: true)
}
}
}
}
 
// MARK: - NavigationMapViewDelegate methods
 
func navigationMapView(_ mapView: NavigationMapView, didSelect route: Route) {
self.currentRoute = route
}
 
// MARK: - NavigationViewControllerDelegate methods
 
func navigationViewController(_ navigationViewController: NavigationViewController, didArriveAt waypoint: Waypoint) -> Bool {
if navigationViewController.navigationService.router.routeProgress.isFinalLeg {
return true
}
 
// In case of intermediate waypoint - proceed to next leg only after specific delay.
let delay = 5.0
DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: {
guard let navigationService = (self.presentedViewController as? NavigationViewController)?.navigationService else { return }
let router = navigationService.router
guard router.route.legs.count > router.routeProgress.legIndex + 1 else { return }
router.routeProgress.legIndex += 1
 
navigationService.start()
})
 
return false
}
 
func navigationViewControllerDidDismiss(_ navigationViewController: NavigationViewController, byCanceling canceled: Bool) {
dismiss(animated: true, completion: nil)
}
 
// MARK: - UIGestureRecognizerDelegate methods
 
func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
// Allow both route selection and building extrusion when tapping on screen.
return true
}
 
// MARK: - Utility methods
 
func presentAlert(_ title: String? = nil, message: String? = nil) {
let alertController = UIAlertController(title: title, message: message, preferredStyle: .alert)
alertController.addAction(UIAlertAction(title: "OK", style: .default, handler: { (_) in
alertController.dismiss(animated: true, completion: nil)
}))
 
present(alertController, animated: true, completion: nil)
}
}
