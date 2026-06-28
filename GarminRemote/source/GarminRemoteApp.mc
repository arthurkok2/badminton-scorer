import Toybox.Application;
import Toybox.WatchUi;

class GarminRemoteApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
        // nothing
    }

    function onStop(state) {
        // nothing
    }

    function getInitialView() {
        var view = new RoomCodeView();
        var delegate = new RoomCodeDelegate(view);
        return [view, delegate];
    }
}

function getApp() {
    return Application.getApp() as GarminRemoteApp;
}
