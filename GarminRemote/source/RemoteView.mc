import Toybox.WatchUi;
import Toybox.Graphics;
import Toybox.Attention;
import Toybox.System;

// The active remote screen. Shows the room code and the three scoring actions.
//
// Button mapping (Forerunner 265):
//   UP    (top-right)    → Team A point
//   DOWN  (bottom-right) → Team B point
//   BACK  (top-left)     → Undo last point
//   START (middle-right) → confirmation dialog to exit (resume / end)
//
// A pending indicator is shown while an HTTP request is in flight.
// Success triggers a short vibration. Failure shows an error message.

enum {
    STATE_IDLE,
    STATE_PENDING,
    STATE_ERROR
}

class RemoteView extends WatchUi.View {

    var _roomCode;
    var _state;
    var _errorMsg;

    function initialize(roomCode) {
        View.initialize();
        _roomCode = roomCode;
        _state = STATE_IDLE;
        _errorMsg = "";
    }

    function onUpdate(dc) {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();

        // Room code
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.05, Graphics.FONT_TINY, "Room: " + _roomCode,
                    Graphics.TEXT_JUSTIFY_CENTER);

        if (_state == STATE_PENDING) {
            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.45, Graphics.FONT_MEDIUM, "Sending...",
                        Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        if (_state == STATE_ERROR) {
            dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.38, Graphics.FONT_SMALL, "Error",
                        Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.52, Graphics.FONT_TINY, _errorMsg,
                        Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(w / 2, h * 0.68, Graphics.FONT_TINY, "Press any button",
                        Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        // Idle — show button labels
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.22, Graphics.FONT_SMALL, "UP: Team A",
                    Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.44, Graphics.FONT_TINY, "BACK: Undo",
                    Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.62, Graphics.FONT_SMALL, "DOWN: Team B",
                    Graphics.TEXT_JUSTIFY_CENTER);
    }

    function setPending() {
        _state = STATE_PENDING;
        WatchUi.requestUpdate();
    }

    function setSuccess() {
        _state = STATE_IDLE;
        vibrateShort();
        WatchUi.requestUpdate();
    }

    function setError(msg) {
        _state = STATE_ERROR;
        _errorMsg = msg;
        WatchUi.requestUpdate();
    }

    function clearError() {
        _state = STATE_IDLE;
        WatchUi.requestUpdate();
    }

    function vibrateShort() {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(50, 120)]);
        }
    }
}

class RemoteDelegate extends WatchUi.BehaviorDelegate {

    var _roomCode;
    var _sourceId;

    function initialize(roomCode) {
        BehaviorDelegate.initialize();
        _roomCode = roomCode;
        _sourceId = Storage.getSourceId();
    }

    // DOWN button — Team B point. Connect IQ raises onNextPage for DOWN,
    // not UP, so these two handlers are the opposite way round to their names.
    function onNextPage() {
        sendCommand("teamB");
        return true;
    }

    // UP button — Team A point (Connect IQ raises onPreviousPage for UP).
    function onPreviousPage() {
        sendCommand("teamA");
        return true;
    }

    // BACK button — Undo last point. Overriding onBack prevents the default
    // behavior of exiting the view, so the app can only be left via START.
    function onBack() {
        sendUndo();
        return true;
    }

    // START button — confirm before exiting the app (resume / end).
    function onSelect() {
        var dialog = new WatchUi.Confirmation("End remote?");
        WatchUi.pushView(dialog, new ExitConfirmationDelegate(), WatchUi.SLIDE_IMMEDIATE);
        return true;
    }

    function sendCommand(teamId) {
        var view = getCurrentView();
        if (view == null) { return; }
        if (view._state == STATE_PENDING) { return; }
        if (view._state == STATE_ERROR) { view.clearError(); return; }

        view.setPending();
        FirestoreClient.sendPoint(_roomCode, teamId, _sourceId,
            method(:onResponse));
    }

    function sendUndo() {
        var view = getCurrentView();
        if (view == null) { return; }
        if (view._state == STATE_PENDING) { return; }
        if (view._state == STATE_ERROR) { view.clearError(); return; }

        view.setPending();
        FirestoreClient.sendUndo(_roomCode, _sourceId,
            method(:onResponse));
    }

    function onResponse(responseCode, data) {
        var view = getCurrentView();
        if (view == null) { return; }

        // Firestore REST returns 200 on successful document creation
        if (responseCode == 200) {
            view.setSuccess();
        } else {
            view.setError("HTTP " + responseCode.toString());
        }
    }

    // Returns the current RemoteView from the WatchUi stack, or null.
    function getCurrentView() {
        var viewStack = WatchUi.getCurrentView();
        if (viewStack != null && viewStack[0] instanceof RemoteView) {
            return viewStack[0] as RemoteView;
        }
        return null;
    }
}

// Handles the "End remote?" confirmation. Confirm exits the app; cancel
// pops the dialog and resumes the remote screen.
class ExitConfirmationDelegate extends WatchUi.ConfirmationDelegate {

    function initialize() {
        ConfirmationDelegate.initialize();
    }

    function onResponse(value) {
        if (value == WatchUi.CONFIRM_YES) {
            System.exit();
        }
        return true;
    }
}
